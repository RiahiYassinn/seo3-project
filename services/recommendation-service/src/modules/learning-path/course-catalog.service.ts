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
  LearningPathStep,
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

    const vectorResults = await this.tryMongoVectorSearch(
      collection,
      vector,
      limit,
      gapLabel,
    );
    if (vectorResults.length > 0) {
      return vectorResults;
    }

    const rankedByEmbedding = await this.rankCoursesByStoredEmbeddings(
      collection,
      gapLabel,
      vector,
      limit,
    );
    if (rankedByEmbedding.length > 0) {
      return rankedByEmbedding;
    }

    return this.findTopCoursesLexically(collection, gapLabel, limit);
  }

  async hydrateRecommendedCourses(
    path: {
      steps: LearningPathStep[];
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
      steps: path.steps.map((step, index) => {
        const selectedIds = this.resolveRecommendedCourseIds(
          step,
          matches,
          courseMap,
          index,
        );

        return {
          ...step,
          gap_keys:
            Array.isArray(step.gap_keys) && step.gap_keys.length > 0
              ? step.gap_keys
              : this.inferGapKeysForStep(step, matches, index),
          recommended_course_ids: selectedIds,
          recommended_courses: selectedIds
            .map((courseId) => courseMap.get(courseId))
            .filter((course): course is RetrievedCourse => !!course),
        };
      }),
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

  private async tryMongoVectorSearch(
    collection: Collection<CourseCatalogDocument & Document>,
    vector: number[],
    limit: number,
    gapLabel: string,
  ) {
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

      return results
        .map((item) => this.normalizeRetrievedCourse(item))
        .filter((item): item is RetrievedCourse => !!item);
    } catch (error) {
      this.logger.warn(
        `Mongo vector search failed for "${gapLabel}", using in-app ranking: ${error instanceof Error ? error.message : error}`,
      );
      return [];
    }
  }

  private async rankCoursesByStoredEmbeddings(
    collection: Collection<CourseCatalogDocument & Document>,
    gapLabel: string,
    queryVector: number[],
    limit: number,
  ): Promise<RetrievedCourse[]> {
    const documents = await collection
      .find({})
      .project({
        _id: 0,
        courseId: 1,
        title: 1,
        url: 1,
        description: 1,
        searchableText: 1,
        skills: 1,
        partner: 1,
        type: 1,
        rating: 1,
        reviewCount: 1,
        embedding: 1,
      })
      .toArray();

    const ranked = documents
      .map((document) => {
        const course = this.normalizeRetrievedCourse(document);
        if (!course) {
          return null;
        }

        const embedding = Array.isArray(document.embedding)
          ? document.embedding.filter(
              (value: unknown): value is number => typeof value === 'number',
            )
          : [];
        const cosine = embedding.length > 0
          ? this.cosineSimilarity(queryVector, embedding)
          : 0;
        const lexicalScore = this.scoreCourseAgainstGap(gapLabel, document);
        const qualityScore = this.courseQualityBonus(course);
        const totalScore = cosine * 0.82 + lexicalScore * 0.14 + qualityScore * 0.04;

        return {
          course: {
            ...course,
            vectorScore: Number(totalScore.toFixed(4)),
          },
          totalScore,
        };
      })
      .filter(
        (
          item,
        ): item is {
          course: RetrievedCourse;
          totalScore: number;
        } => !!item,
      )
      .sort((left, right) => right.totalScore - left.totalScore)
      .filter((item) => item.totalScore > 0.12)
      .slice(0, limit)
      .map((item) => item.course);

    return ranked;
  }

  private async findTopCoursesLexically(
    collection: Collection<CourseCatalogDocument & Document>,
    gapLabel: string,
    limit: number,
  ): Promise<RetrievedCourse[]> {
    const documents = await collection
      .find({})
      .project({
        _id: 0,
        courseId: 1,
        title: 1,
        url: 1,
        description: 1,
        searchableText: 1,
        skills: 1,
        partner: 1,
        type: 1,
        rating: 1,
        reviewCount: 1,
      })
      .toArray();

    return documents
      .map((document) => {
        const course = this.normalizeRetrievedCourse(document);
        if (!course) {
          return null;
        }

        return {
          course: {
            ...course,
            vectorScore: null,
          },
          lexicalScore: this.scoreCourseAgainstGap(gapLabel, document),
        };
      })
      .filter(
        (
          item,
        ): item is {
          course: RetrievedCourse;
          lexicalScore: number;
        } => !!item && item.lexicalScore > 0,
      )
      .sort((left, right) => {
        if (right.lexicalScore !== left.lexicalScore) {
          return right.lexicalScore - left.lexicalScore;
        }

        return this.courseQualityBonus(right.course) - this.courseQualityBonus(left.course);
      })
      .slice(0, limit)
      .map((item) => item.course);
  }

  private normalizeRetrievedCourse(raw: Record<string, any>): RetrievedCourse | null {
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
    const inferredSkills = this.inferSkills(
      [title, description, raw.searchableText || ''].filter(Boolean).join(' '),
    );

    return {
      courseId: this.buildCourseId(raw, title, url),
      title,
      url,
      description,
      skills: Array.from(new Set([...suppliedSkills, ...inferredSkills])).slice(0, 12),
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
      vectorScore:
        typeof raw.vectorScore === 'number'
          ? raw.vectorScore
          : raw.vectorScore
            ? Number(raw.vectorScore)
            : null,
    };
  }

  private scoreCourseAgainstGap(gapLabel: string, raw: Record<string, any>) {
    const normalizedText = this.cleanText(
      [
        raw.title || raw.name || '',
        raw.description || raw.summary || raw.searchableText || '',
        ...(Array.isArray(raw.skills) ? raw.skills : []),
        raw.partner || '',
        raw.type || '',
      ]
        .filter(Boolean)
        .join(' '),
    ).toLowerCase();

    if (!normalizedText) {
      return 0;
    }

    const searchTerms = this.expandSearchTerms(gapLabel);
    const uniqueTerms = Array.from(new Set(searchTerms));
    const matchedTerms = uniqueTerms.filter((term) => normalizedText.includes(term));
    const coverageScore = matchedTerms.length / Math.max(uniqueTerms.length, 1);
    const titleBoost = uniqueTerms.reduce((score, term) => {
      const title = this.cleanText(raw.title || raw.name || '').toLowerCase();
      return score + (title.includes(term) ? 0.22 : 0);
    }, 0);

    return Number((coverageScore + titleBoost).toFixed(4));
  }

  private expandSearchTerms(gapLabel: string) {
    const normalized = gapLabel.toLowerCase();
    const baseTerms = normalized
      .split(/[^a-z0-9]+/)
      .map((term) => term.trim())
      .filter((term) => term.length >= 3);

    const synonymMap: Array<[RegExp, string[]]> = [
      [/(async|promise|concurrency|error handling|reliability)/, ['async', 'promise', 'error handling', 'reliability']],
      [/(typescript|type safety|typing)/, ['typescript', 'type safety', 'typing']],
      [/(testing|regression|qa|unit)/, ['testing', 'unit testing', 'qa', 'regression']],
      [/(documentation|readability|maintainability|clean code)/, ['documentation', 'readability', 'clean code', 'maintainability']],
      [/(api|backend|service|microservice)/, ['api', 'backend', 'service design', 'microservices']],
      [/(security|auth|secret|secrets|authentication|authorization)/, ['security', 'auth', 'authentication', 'authorization']],
      [/(devops|ci\/cd|cicd|docker|kubernetes|deployment)/, ['devops', 'ci/cd', 'cicd', 'docker', 'kubernetes', 'deployment']],
      [/(python|exception)/, ['python', 'exception handling']],
    ];

    const synonyms = synonymMap
      .filter(([pattern]) => pattern.test(normalized))
      .flatMap(([, tokens]) => tokens);

    return [...baseTerms, ...synonyms];
  }

  private cosineSimilarity(left: number[], right: number[]) {
    const size = Math.min(left.length, right.length);
    if (size === 0) {
      return 0;
    }

    let dot = 0;
    let leftMagnitude = 0;
    let rightMagnitude = 0;

    for (let index = 0; index < size; index += 1) {
      const leftValue = left[index] || 0;
      const rightValue = right[index] || 0;
      dot += leftValue * rightValue;
      leftMagnitude += leftValue * leftValue;
      rightMagnitude += rightValue * rightValue;
    }

    if (leftMagnitude === 0 || rightMagnitude === 0) {
      return 0;
    }

    return dot / (Math.sqrt(leftMagnitude) * Math.sqrt(rightMagnitude));
  }

  private courseQualityBonus(course: RetrievedCourse) {
    const ratingScore =
      typeof course.rating === 'number' ? Math.max(0, Math.min(1, course.rating / 5)) : 0;
    const reviewScore =
      typeof course.reviewCount === 'number' && course.reviewCount > 0
        ? Math.min(1, Math.log10(course.reviewCount + 1) / 4)
        : 0;

    return Number((ratingScore * 0.7 + reviewScore * 0.3).toFixed(4));
  }

  private resolveRecommendedCourseIds(
    step: LearningPathStep,
    matches: GapCourseMatch[],
    courseMap: Map<string, RetrievedCourse>,
    index: number,
  ) {
    const directIds = Array.isArray(step.recommended_course_ids)
      ? step.recommended_course_ids
          .map((courseId) => String(courseId))
          .filter((courseId) => courseMap.has(courseId))
      : [];
    const gapKeys = this.inferGapKeysForStep(step, matches, index);
    const gapCourseIds = gapKeys.flatMap((gapKey) =>
      (matches.find((match) => match.gap.key === gapKey)?.courses || []).map(
        (course) => course.courseId,
      ),
    );
    const globalFallbackIds = matches.flatMap((match) =>
      match.courses.map((course) => course.courseId),
    );

    return Array.from(new Set([...directIds, ...gapCourseIds, ...globalFallbackIds]))
      .filter((courseId) => courseMap.has(courseId))
      .slice(0, 2);
  }

  private inferGapKeysForStep(
    step: LearningPathStep,
    matches: GapCourseMatch[],
    index: number,
  ) {
    if (Array.isArray(step.gap_keys) && step.gap_keys.length > 0) {
      return step.gap_keys;
    }

    const renderedStep = this.cleanText(
      [step.title, step.goal, step.practice_task, step.why_it_matters]
        .filter(Boolean)
        .join(' '),
    ).toLowerCase();
    const matchedGapKeys = matches
      .filter((match) => {
        const label = match.gap.label.toLowerCase();
        const key = match.gap.key.toLowerCase();
        return renderedStep.includes(label) || renderedStep.includes(key.replace(/_/g, ' '));
      })
      .map((match) => match.gap.key);

    if (matchedGapKeys.length > 0) {
      return matchedGapKeys;
    }

    const orderedFallback = matches[index]?.gap?.key;
    return orderedFallback ? [orderedFallback] : [];
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
