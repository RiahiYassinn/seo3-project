import {
  Injectable,
  InternalServerErrorException,
  Logger,
  OnModuleDestroy,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { existsSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { isAbsolute, resolve } from 'node:path';
import { Collection, Db, Document, MongoClient } from 'mongodb';
import {
  CourseCatalogDocument,
  GapCourseMatch,
  RetrievedCourse,
} from './recommendation-rag.types';
import { LlmClientService } from './llm-client.service';

type CourseCatalogDraft = Omit<CourseCatalogDocument, 'embedding' | 'updatedAt'>;

@Injectable()
export class CourseCatalogService implements OnModuleDestroy {
  private readonly logger = new Logger(CourseCatalogService.name);
  private mongoClient: MongoClient | null = null;
  private database: Db | null = null;

  constructor(
    private readonly configService: ConfigService,
    private readonly llmClientService: LlmClientService,
  ) {}

  async onModuleDestroy() {
    if (this.mongoClient) {
      await this.mongoClient.close();
      this.mongoClient = null;
      this.database = null;
    }
  }

  async ingestFromFile(filePath?: string) {
    const effectivePath =
      filePath ||
      this.configService.get<string>('COURSE_CATALOG_DATA_PATH') ||
      'courses.json';
    const absolutePath = this.resolveInputPath(effectivePath);
    const raw = await readFile(absolutePath, 'utf8');
    const parsed = JSON.parse(raw);

    if (!Array.isArray(parsed)) {
      throw new InternalServerErrorException(
        'Course catalog file must be a JSON array',
      );
    }

    const collection = await this.getCollection();
    const drafts = (
      await Promise.all(
        parsed.map((item) => this.normalizeCourse(item as Record<string, any>)),
      )
    ).filter((item): item is CourseCatalogDraft => !!item);
    let processed = 0;
    const batchSize = Number(
      this.configService.get<string>('COURSE_EMBED_BATCH_SIZE') || 24,
    );

    for (let index = 0; index < drafts.length; index += batchSize) {
      const batch = drafts.slice(index, index + batchSize);
      const embeddings = await this.llmClientService.embedTexts(
        batch.map((item) => item.searchableText),
        'RETRIEVAL_DOCUMENT',
      );

      const operations = batch.map((draft, batchIndex) => ({
        updateOne: {
          filter: { courseId: draft.courseId },
          update: {
            $set: {
              ...draft,
              embedding: embeddings[batchIndex],
              updatedAt: new Date().toISOString(),
            },
          },
          upsert: true,
        },
      }));

      if (operations.length > 0) {
        await collection.bulkWrite(operations);
        processed += operations.length;
      }
    }

    this.logger.log(`Ingested ${processed} course catalog records from ${absolutePath}`);
    return { processed, path: absolutePath };
  }

  async findTopCoursesForGap(gapLabel: string, limit = 3): Promise<RetrievedCourse[]> {
    const collection = await this.getCollection();
    const vector = await this.llmClientService.embedText(
      gapLabel,
      'RETRIEVAL_QUERY',
    );

    try {
      const results = await collection
        .aggregate<RetrievedCourse>([
          {
            $vectorSearch: {
              index:
                this.configService.get<string>('MONGODB_VECTOR_INDEX') ||
                'course_embedding_index',
              path: 'embedding',
              queryVector: vector,
              numCandidates: Math.max(24, limit * 8),
              limit,
            },
          },
          {
            $project: {
              _id: 0,
              courseId: 1,
              title: 1,
              url: 1,
              description: 1,
              skills: 1,
              partner: 1,
              type: 1,
              rating: 1,
              reviewCount: 1,
              vectorScore: { $meta: 'vectorSearchScore' },
            },
          },
        ])
        .toArray();

      if (results.length > 0) {
        return results;
      }
    } catch (error) {
      this.logger.warn(
        `Vector search failed for "${gapLabel}", using lexical fallback: ${error instanceof Error ? error.message : error}`,
      );
    }

    const escaped = gapLabel.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const fallbackResults = await collection
      .find({
        searchableText: {
          $regex: escaped,
          $options: 'i',
        },
      })
      .project({
        _id: 0,
        courseId: 1,
        title: 1,
        url: 1,
        description: 1,
        skills: 1,
        partner: 1,
        type: 1,
        rating: 1,
        reviewCount: 1,
      })
      .limit(limit)
      .toArray();

    return fallbackResults.map((course) => ({
      ...course,
      vectorScore: null,
    })) as RetrievedCourse[];
  }

  async hydrateRecommendedCourses(
    path: {
      steps: Array<{
        recommended_course_ids?: string[];
      }>;
    },
    matches: GapCourseMatch[],
  ) {
    const courseMap = new Map<string, RetrievedCourse>();
    for (const match of matches) {
      for (const course of match.courses) {
        courseMap.set(course.courseId, course);
      }
    }

    return {
      ...path,
      steps: path.steps.map((step) => ({
        ...step,
        recommended_courses: (step.recommended_course_ids || [])
          .map((courseId) => courseMap.get(courseId))
          .filter((course): course is RetrievedCourse => !!course),
      })),
    };
  }

  private async normalizeCourse(raw: Record<string, any>): Promise<CourseCatalogDraft | null> {
    const title = this.cleanText(
      raw.title || raw.name || raw.course_title || raw.courseTitle || '',
    );
    const url = this.cleanText(raw.url || raw.course_url || raw.link || '');

    if (!title || !url) {
      return null;
    }

    const description = this.cleanText(
      raw.description ||
        raw.summary ||
        raw.shortDescription ||
        raw.long_description ||
        raw.about ||
        '',
    );
    const suppliedSkills = this.extractStringArray(
      raw.skills ||
        raw.skill_names ||
        raw.tags ||
        raw.categories ||
        raw.topics ||
        [],
    );
    const inferredSkills = this.inferSkills(`${title} ${description}`);
    const skills = Array.from(new Set([...suppliedSkills, ...inferredSkills])).slice(0, 12);
    const searchableText = this.cleanText(
      [title, description, skills.join(' '), raw.partner || '', raw.type || '']
        .filter(Boolean)
        .join(' '),
    );

    return {
      courseId: this.buildCourseId(raw, title, url),
      title,
      url,
      description,
      skills,
      partner: raw.partner ? String(raw.partner) : null,
      type: raw.type ? String(raw.type) : null,
      rating:
        typeof raw.rating === 'number'
          ? raw.rating
          : raw.rating
            ? Number(raw.rating)
            : null,
      reviewCount:
        typeof raw.reviewCount === 'number'
          ? raw.reviewCount
          : raw.reviewCount
          ? Number(raw.reviewCount)
          : null,
      searchableText,
    };
  }

  private buildCourseId(raw: Record<string, any>, title: string, url: string) {
    if (raw.id) {
      return String(raw.id);
    }

    const urlStem = url
      .replace(/^https?:\/\//, '')
      .replace(/[^a-z0-9]+/gi, '-')
      .replace(/^-+|-+$/g, '')
      .toLowerCase();
    const titleStem = title
      .replace(/[^a-z0-9]+/gi, '-')
      .replace(/^-+|-+$/g, '')
      .toLowerCase();

    return `${titleStem || 'course'}-${urlStem.slice(-36)}`;
  }

  private extractStringArray(value: unknown): string[] {
    if (!Array.isArray(value)) {
      return [];
    }

    return value
      .map((item) => this.cleanText(typeof item === 'string' ? item : item?.name || item?.title || ''))
      .filter(Boolean);
  }

  private inferSkills(text: string) {
    const normalized = text.toLowerCase();
    const skillMap: Array<[string, string[]]> = [
      ['React performance', ['react', 'frontend', 'hooks', 'component']],
      ['JavaScript', ['javascript']],
      ['TypeScript', ['typescript']],
      ['Node.js APIs', ['node', 'api', 'backend', 'express', 'nest']],
      ['SQL and database safety', ['sql', 'database', 'postgres', 'mysql']],
      ['SQL injection prevention', ['sql injection', 'security', 'auth']],
      ['Testing strategy', ['test', 'jest', 'qa', 'unit testing']],
      ['Python reliability', ['python', 'exception']],
      ['Async reliability', ['async', 'concurrency', 'promise']],
      ['API design', ['rest', 'api design', 'microservices']],
      ['System design', ['architecture', 'system design', 'distributed']],
      ['Docker and DevOps', ['docker', 'kubernetes', 'devops', 'ci/cd']],
    ];

    return skillMap
      .filter(([, tokens]) => tokens.some((token) => normalized.includes(token)))
      .map(([label]) => label);
  }

  private cleanText(value: string) {
    return String(value || '')
      .replace(/<[^>]+>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  private resolveInputPath(inputPath: string) {
    const rawCandidates = isAbsolute(inputPath)
      ? [inputPath]
      : [
          resolve(process.cwd(), inputPath),
          resolve(__dirname, '..', '..', '..', inputPath),
          resolve(__dirname, '..', '..', '..', '..', '..', inputPath),
        ];

    const extensionCandidates = rawCandidates.flatMap((candidate) =>
      candidate.endsWith('.json')
        ? [candidate]
        : [candidate, `${candidate}.json`],
    );

    const found = extensionCandidates.find((candidate) => existsSync(candidate));
    return found || extensionCandidates[0];
  }

  private async getCollection(): Promise<Collection<CourseCatalogDocument & Document>> {
    const db = await this.getDatabase();
    return db.collection<CourseCatalogDocument>(
      this.configService.get<string>('MONGODB_VECTOR_COLLECTION') || 'course_catalog',
    );
  }

  private async getDatabase() {
    if (this.database) {
      return this.database;
    }

    const uri =
      this.configService.get<string>('MONGODB_VECTOR_URI') ||
      this.configService.get<string>('MONGODB_ATLAS_URI') ||
      this.configService.get<string>('MONGODB_URL');

    if (!uri) {
      throw new InternalServerErrorException(
        'MongoDB connection string is missing',
      );
    }

    this.mongoClient = new MongoClient(uri);
    await this.mongoClient.connect();
    this.database = this.mongoClient.db(
      this.configService.get<string>('MONGODB_VECTOR_DATABASE') ||
        this.configService.get<string>('MONGODB_DATABASE') ||
        'seo3_analytics',
    );

    return this.database;
  }
}
