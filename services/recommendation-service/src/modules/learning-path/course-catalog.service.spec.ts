import { Logger } from '@nestjs/common';
import { CourseCatalogService } from './course-catalog.service';
import {
  GapCourseMatch,
  LearningPathStep,
  RetrievedCourse,
} from './recommendation-rag.types';

/**
 * Everything reachable without Mongo or an embedding provider: catalog
 * normalisation, the lexical fallback ranking used when vector search is
 * unavailable, and the step/course stitching that produces the final path.
 */
type ServiceInternals = {
  cleanText(value: string): string;
  buildCourseId(raw: Record<string, any>, title: string, url: string): string;
  extractStringArray(value: unknown): string[];
  inferSkills(text: string): string[];
  normalizeCourse(raw: Record<string, any>): Promise<Record<string, any> | null>;
  normalizeRetrievedCourse(raw: Record<string, any>): RetrievedCourse | null;
  expandSearchTerms(gapLabel: string): string[];
  scoreCourseAgainstGap(gapLabel: string, raw: Record<string, any>): number;
  cosineSimilarity(left: number[], right: number[]): number;
  courseQualityBonus(course: Partial<RetrievedCourse>): number;
  inferGapKeysForStep(
    step: Partial<LearningPathStep>,
    matches: GapCourseMatch[],
    index: number,
  ): string[];
};

const course = (overrides: Partial<RetrievedCourse> = {}): RetrievedCourse =>
  ({
    courseId: 'c1',
    title: 'Course',
    url: 'https://example.com/c1',
    description: '',
    skills: [],
    partner: null,
    type: null,
    rating: null,
    reviewCount: null,
    vectorScore: null,
    ...overrides,
  }) as RetrievedCourse;

const match = (key: string, courseIds: string[]): GapCourseMatch => ({
  gap: { key, label: key.replace(/_/g, ' '), score: 1, severity: 'high', evidence: [] },
  courses: courseIds.map((courseId) => course({ courseId })),
});

describe('CourseCatalogService', () => {
  let service: ServiceInternals;
  let publicService: CourseCatalogService;

  beforeAll(() => {
    Logger.overrideLogger(false);
  });

  beforeEach(() => {
    const configService = { get: jest.fn(() => undefined) };
    const llmClientService = { embedText: jest.fn(), embedTexts: jest.fn() };
    publicService = new CourseCatalogService(
      configService as never,
      llmClientService as never,
    );
    service = publicService as never;
  });

  describe('cleanText', () => {
    it('strips HTML tags left in scraped descriptions', () => {
      expect(service.cleanText('<p>Learn <b>React</b></p>')).toBe('Learn React');
    });

    it('collapses runs of whitespace and newlines', () => {
      expect(service.cleanText('a \n\n  b\tc')).toBe('a b c');
    });

    it.each([null, undefined, ''])('returns an empty string for %s', (value) => {
      expect(service.cleanText(value as never)).toBe('');
    });
  });

  describe('buildCourseId', () => {
    it('uses the supplied id verbatim when present', () => {
      expect(service.buildCourseId({ id: 42 }, 'Title', 'https://x.io')).toBe('42');
    });

    it('derives a slug from the title and the tail of the URL', () => {
      const id = service.buildCourseId(
        {},
        'React Performance',
        'https://coursera.org/learn/react-perf',
      );

      expect(id).toMatch(/^react-performance-/);
      expect(id).not.toContain('https://');
    });

    it('is stable for the same title and URL', () => {
      const args = [{}, 'Testing 101', 'https://x.io/t'] as const;

      expect(service.buildCourseId(...args)).toBe(service.buildCourseId(...args));
    });

    it('falls back to "course" when the title has no usable characters', () => {
      expect(service.buildCourseId({}, '!!!', 'https://x.io/t')).toMatch(/^course-/);
    });
  });

  describe('extractStringArray', () => {
    it('returns an empty array for a non-array value', () => {
      expect(service.extractStringArray('react')).toEqual([]);
    });

    it('accepts plain strings and objects carrying name or title', () => {
      expect(
        service.extractStringArray(['React', { name: 'Node' }, { title: 'SQL' }]),
      ).toEqual(['React', 'Node', 'SQL']);
    });

    it('drops entries that yield nothing usable', () => {
      expect(service.extractStringArray(['React', {}, '', null])).toEqual(['React']);
    });
  });

  describe('inferSkills', () => {
    it('tags a React course from its title', () => {
      expect(service.inferSkills('Advanced React Hooks')).toContain(
        'React performance',
      );
    });

    it('can return several labels for one description', () => {
      const skills = service.inferSkills('Testing Python exception handling');

      expect(skills).toEqual(
        expect.arrayContaining(['Testing strategy', 'Python reliability']),
      );
    });

    it('is case insensitive', () => {
      expect(service.inferSkills('DOCKER for teams')).toContain('Docker and DevOps');
    });

    it('returns nothing for unrelated copy', () => {
      expect(service.inferSkills('Watercolour painting for beginners')).toEqual([]);
    });
  });

  describe('normalizeCourse', () => {
    it.each([
      ['no title', { url: 'https://x.io' }],
      ['no url', { title: 'A course' }],
      ['an empty record', {}],
    ])('rejects a record with %s', async (_label, raw) => {
      await expect(service.normalizeCourse(raw)).resolves.toBeNull();
    });

    it.each(['name', 'course_title', 'courseTitle'])(
      'accepts %s as the title field',
      async (field) => {
        const result = await service.normalizeCourse({
          [field]: 'A course',
          url: 'https://x.io',
        });

        expect(result?.title).toBe('A course');
      },
    );

    it.each(['course_url', 'link'])('accepts %s as the url field', async (field) => {
      const result = await service.normalizeCourse({
        title: 'A course',
        [field]: 'https://x.io',
      });

      expect(result?.url).toBe('https://x.io');
    });

    it('merges supplied tags with inferred skills and de-duplicates', async () => {
      const result = await service.normalizeCourse({
        title: 'React Performance',
        url: 'https://x.io',
        tags: ['React performance', 'Frontend'],
      });

      expect(result?.skills).toEqual(['React performance', 'Frontend']);
    });

    it('caps the skill list at twelve entries', async () => {
      const result = await service.normalizeCourse({
        title: 'Everything',
        url: 'https://x.io',
        tags: Array.from({ length: 30 }, (_, index) => `tag-${index}`),
      });

      expect(result?.skills).toHaveLength(12);
    });

    it('coerces a numeric-string rating and review count', async () => {
      const result = await service.normalizeCourse({
        title: 'A course',
        url: 'https://x.io',
        rating: '4.7',
        reviewCount: '1200',
      });

      expect(result).toMatchObject({ rating: 4.7, reviewCount: 1200 });
    });

    it('leaves a missing rating as null rather than zero', async () => {
      const result = await service.normalizeCourse({
        title: 'A course',
        url: 'https://x.io',
      });

      expect(result).toMatchObject({ rating: null, reviewCount: null });
    });

    it('builds searchable text from title, description and skills', async () => {
      const result = await service.normalizeCourse({
        title: 'React Performance',
        url: 'https://x.io',
        description: '<p>Make components fast</p>',
        partner: 'Coursera',
      });

      expect(result?.searchableText).toContain('React Performance');
      expect(result?.searchableText).toContain('Make components fast');
      expect(result?.searchableText).toContain('Coursera');
      expect(result?.searchableText).not.toContain('<p>');
    });
  });

  describe('expandSearchTerms', () => {
    it('drops tokens shorter than three characters', () => {
      expect(service.expandSearchTerms('go to db')).toEqual([]);
    });

    it('splits on non-alphanumeric separators', () => {
      expect(service.expandSearchTerms('type-safety')).toEqual(
        expect.arrayContaining(['type', 'safety']),
      );
    });

    it('adds synonyms so a gap key matches differently-worded courses', () => {
      expect(service.expandSearchTerms('async error handling')).toEqual(
        expect.arrayContaining(['promise', 'reliability']),
      );
    });

    it('expands security-adjacent wording', () => {
      expect(service.expandSearchTerms('authentication')).toEqual(
        expect.arrayContaining(['security', 'authorization']),
      );
    });
  });

  describe('scoreCourseAgainstGap', () => {
    it('scores zero for a course with no indexable text', () => {
      expect(service.scoreCourseAgainstGap('testing', {})).toBe(0);
    });

    it('scores zero when nothing in the course matches the gap', () => {
      expect(
        service.scoreCourseAgainstGap('testing reliability', {
          title: 'Watercolour painting',
        }),
      ).toBe(0);
    });

    it('scores a partial match below a full one', () => {
      const partial = service.scoreCourseAgainstGap('python exception handling', {
        description: 'python basics',
      });
      const full = service.scoreCourseAgainstGap('python exception handling', {
        description: 'python exception handling and reliability',
      });

      expect(full).toBeGreaterThan(partial);
      expect(partial).toBeGreaterThan(0);
    });

    it('boosts a course whose title carries the gap terms', () => {
      const inTitle = service.scoreCourseAgainstGap('testing', {
        title: 'Testing strategy',
      });
      const inDescriptionOnly = service.scoreCourseAgainstGap('testing', {
        title: 'Something else',
        description: 'testing strategy',
      });

      expect(inTitle).toBeGreaterThan(inDescriptionOnly);
    });

    it('searches the skills array as well as the prose', () => {
      expect(
        service.scoreCourseAgainstGap('docker', {
          title: 'Ops',
          skills: ['docker', 'kubernetes'],
        }),
      ).toBeGreaterThan(0);
    });
  });

  describe('cosineSimilarity', () => {
    it('is 1 for identical vectors', () => {
      expect(service.cosineSimilarity([1, 2, 3], [1, 2, 3])).toBeCloseTo(1);
    });

    it('is 0 for orthogonal vectors', () => {
      expect(service.cosineSimilarity([1, 0], [0, 1])).toBe(0);
    });

    it('is -1 for opposing vectors', () => {
      expect(service.cosineSimilarity([1, 2], [-1, -2])).toBeCloseTo(-1);
    });

    it('ignores magnitude', () => {
      expect(service.cosineSimilarity([1, 1], [10, 10])).toBeCloseTo(1);
    });

    it.each([
      ['an empty vector', [] as number[], [1, 2]],
      ['a zero vector', [0, 0], [1, 2]],
    ])('returns 0 for %s', (_label, left, right) => {
      expect(service.cosineSimilarity(left, right)).toBe(0);
    });

    it('compares only the overlapping dimensions of mismatched vectors', () => {
      expect(service.cosineSimilarity([1, 1, 99], [1, 1])).toBeCloseTo(1);
    });
  });

  describe('courseQualityBonus', () => {
    it('is 0 for a course with no rating or reviews', () => {
      expect(service.courseQualityBonus(course())).toBe(0);
    });

    it('rewards a higher rating', () => {
      expect(service.courseQualityBonus(course({ rating: 5 }))).toBeGreaterThan(
        service.courseQualityBonus(course({ rating: 3 })),
      );
    });

    it('rewards a larger review count with diminishing returns', () => {
      const few = service.courseQualityBonus(course({ reviewCount: 10 }));
      const many = service.courseQualityBonus(course({ reviewCount: 1000 }));
      const enormous = service.courseQualityBonus(course({ reviewCount: 1_000_000 }));

      expect(many).toBeGreaterThan(few);
      expect(enormous - many).toBeLessThan(many - few);
    });

    it('never exceeds 1 even for an out-of-range rating', () => {
      expect(
        service.courseQualityBonus(course({ rating: 50, reviewCount: 10 ** 9 })),
      ).toBeLessThanOrEqual(1);
    });

    it('ignores a negative rating rather than going below zero', () => {
      expect(service.courseQualityBonus(course({ rating: -5 }))).toBe(0);
    });
  });

  describe('normalizeRetrievedCourse', () => {
    it('returns null when the record has no title or url', () => {
      expect(service.normalizeRetrievedCourse({ description: 'x' })).toBeNull();
    });

    it('keeps a vector score supplied by the search stage', () => {
      const result = service.normalizeRetrievedCourse({
        courseId: 'c1',
        title: 'A course',
        url: 'https://x.io',
        vectorScore: 0.82,
      });

      expect(result?.vectorScore).toBeCloseTo(0.82);
    });
  });

  describe('inferGapKeysForStep', () => {
    const matches = [match('async_error_handling', ['c1']), match('type_safety', ['c2'])];

    it('trusts explicit gap keys on the step', () => {
      expect(
        service.inferGapKeysForStep({ gap_keys: ['type_safety'] }, matches, 0),
      ).toEqual(['type_safety']);
    });

    it('matches a gap label mentioned in the step copy', () => {
      expect(
        service.inferGapKeysForStep(
          { title: 'Fix your async error handling', goal: '' },
          matches,
          0,
        ),
      ).toEqual(['async_error_handling']);
    });

    it('falls back to the gap at the same position when nothing matches', () => {
      expect(
        service.inferGapKeysForStep({ title: 'Unrelated' }, matches, 1),
      ).toEqual(['type_safety']);
    });

    it('returns nothing when the index is past the end of the gap list', () => {
      expect(service.inferGapKeysForStep({ title: 'Unrelated' }, matches, 9)).toEqual(
        [],
      );
    });
  });

  describe('hydrateRecommendedCourses', () => {
    const matches = [
      match('async_error_handling', ['c1', 'c2', 'c3']),
      match('type_safety', ['c4']),
    ];

    const step = (overrides: Partial<LearningPathStep> = {}): LearningPathStep =>
      ({
        order: 1,
        title: 'Step',
        goal: '',
        why_it_matters: '',
        practice_task: '',
        success_signal: '',
        estimated_hours: 2,
        gap_keys: [],
        recommended_course_ids: [],
        ...overrides,
      }) as LearningPathStep;

    it('attaches at most two courses per step', async () => {
      const result = await publicService.hydrateRecommendedCourses(
        { steps: [step({ gap_keys: ['async_error_handling'] })] },
        matches,
      );

      expect(result.steps[0].recommended_course_ids).toEqual(['c1', 'c2']);
      expect(result.steps[0].recommended_courses).toHaveLength(2);
    });

    it('honours course ids the generator already chose', async () => {
      const result = await publicService.hydrateRecommendedCourses(
        {
          steps: [
            step({
              gap_keys: ['async_error_handling'],
              recommended_course_ids: ['c4'],
            }),
          ],
        },
        matches,
      );

      expect(result.steps[0].recommended_course_ids[0]).toBe('c4');
    });

    it('discards ids that are not in the retrieved set', async () => {
      const result = await publicService.hydrateRecommendedCourses(
        {
          steps: [
            step({
              gap_keys: ['type_safety'],
              recommended_course_ids: ['ghost-course'],
            }),
          ],
        },
        matches,
      );

      expect(result.steps[0].recommended_course_ids).not.toContain('ghost-course');
      expect(result.steps[0].recommended_course_ids).toContain('c4');
    });

    it('backfills gap keys the generator left empty', async () => {
      const result = await publicService.hydrateRecommendedCourses(
        { steps: [step({ title: 'Improve type safety' })] },
        matches,
      );

      expect(result.steps[0].gap_keys).toEqual(['type_safety']);
    });

    it('still recommends something when a step matches no gap at all', async () => {
      const result = await publicService.hydrateRecommendedCourses(
        { steps: [step({ title: 'Unrelated' })] },
        matches,
      );

      expect(result.steps[0].recommended_course_ids.length).toBeGreaterThan(0);
    });

    it('returns an empty path unchanged', async () => {
      await expect(
        publicService.hydrateRecommendedCourses({ steps: [] }, matches),
      ).resolves.toEqual({ steps: [] });
    });
  });
});
