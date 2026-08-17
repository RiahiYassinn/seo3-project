import { SkillService } from './skill.service';

type Event = Parameters<SkillService['ingestRepositoryAnalysis']>[0];

const event = (overrides: Partial<Event> = {}): Event =>
  ({
    repositoryId: 'repo-1',
    developerId: 'dev-1',
    repoName: 'devlab/platform',
    analyzedAt: '2024-03-09T12:00:00Z',
    summary: {
      weakness_scores: {},
      quality_score: 7,
    },
    ...overrides,
  }) as Event;

/**
 * Mongoose model double. `updateDeveloperSkill` chains `.exec()`, so
 * `findOneAndUpdate` has to return a thenable-shaped object; `stored` records
 * what the service asked to persist, keyed by skill name.
 */
const createModels = (existing: Record<string, any> = {}) => {
  const stored: Record<string, any> = {};

  const developerSkillModel = {
    findOne: jest.fn(async ({ skillName }: any) => existing[skillName] || null),
    findOneAndUpdate: jest.fn(
      (filter: any, update: any) => {
        stored[filter.skillName] = update.$set;
        return { exec: async () => update.$set };
      },
    ),
    find: jest.fn(() => ({ exec: async () => [] })),
  };

  const skillModel = { find: jest.fn(() => ({ exec: async () => [] })) };

  return { stored, developerSkillModel, skillModel };
};

const build = (existing: Record<string, any> = {}) => {
  const models = createModels(existing);
  const service = new SkillService(
    models.skillModel as never,
    models.developerSkillModel as never,
  );

  return { service, ...models };
};

describe('ingestRepositoryAnalysis', () => {
  describe('developer resolution', () => {
    it('prefers requestedByUserId over developerId', async () => {
      const { service, developerSkillModel } = build();

      await service.ingestRepositoryAnalysis(
        event({ requestedByUserId: 'requester-1', developerId: 'dev-1' }),
      );

      expect(developerSkillModel.findOneAndUpdate).toHaveBeenCalledWith(
        expect.objectContaining({ developerId: 'requester-1' }),
        expect.anything(),
        expect.anything(),
      );
    });

    it('does nothing when the event names nobody', async () => {
      const { service, developerSkillModel } = build();

      await service.ingestRepositoryAnalysis(
        event({ developerId: undefined, requestedByUserId: undefined }),
      );

      expect(developerSkillModel.findOneAndUpdate).not.toHaveBeenCalled();
    });
  });

  describe('skill level', () => {
    it.each([
      [9, 'advanced'],
      [8, 'advanced'],
      [7, 'intermediate'],
      [5.5, 'intermediate'],
      [5.4, 'beginner'],
      [0, 'beginner'],
      [null, 'beginner'],
    ])('infers %s as %s', async (qualityScore, expected) => {
      const { service, stored } = build();

      await service.ingestRepositoryAnalysis(
        event({ summary: { weakness_scores: {}, quality_score: qualityScore } } as never),
      );

      expect(stored.overall_code_quality.statistics.skillLevel).toBe(expected);
    });

    it('honours an explicit skill_level instead of inferring one', async () => {
      const { service, stored } = build();

      await service.ingestRepositoryAnalysis(
        event({
          summary: {
            weakness_scores: {},
            quality_score: 2,
            skill_level: 'expert',
          },
        } as never),
      );

      expect(stored.overall_code_quality.statistics.skillLevel).toBe('expert');
    });
  });

  describe('proficiency', () => {
    it('converts a weakness score into an inverted 0-10 proficiency', async () => {
      const { service, stored } = build();

      await service.ingestRepositoryAnalysis(
        event({
          summary: { weakness_scores: { type_safety: 0.25 }, quality_score: 7 },
        } as never),
      );

      expect(stored.type_safety).toMatchObject({
        proficiency: 7.5,
        commitCount: 1,
      });
    });

    it('rolls a new sample into the running average for a known skill', async () => {
      const { service, stored } = build({
        type_safety: { proficiency: 4, commitCount: 1 },
      });

      await service.ingestRepositoryAnalysis(
        event({
          summary: { weakness_scores: { type_safety: 0.2 }, quality_score: 7 },
        } as never),
      );

      // (4 * 1 + 8) / 2
      expect(stored.type_safety).toMatchObject({ proficiency: 6, commitCount: 2 });
    });

    it('averages the overall quality score across analyses', async () => {
      const { service, stored } = build({
        overall_code_quality: { proficiency: 5, commitCount: 1 },
      });

      await service.ingestRepositoryAnalysis(
        event({ summary: { weakness_scores: {}, quality_score: 9 } } as never),
      );

      expect(stored.overall_code_quality).toMatchObject({
        proficiency: 7,
        commitCount: 2,
      });
    });

    it('treats a null quality score as zero rather than NaN', async () => {
      const { service, stored } = build();

      await service.ingestRepositoryAnalysis(
        event({ summary: { weakness_scores: {}, quality_score: null } } as never),
      );

      expect(stored.overall_code_quality.proficiency).toBe(0);
    });

    it('writes one record per weakness plus the overall roll-up', async () => {
      const { service, stored } = build();

      await service.ingestRepositoryAnalysis(
        event({
          summary: {
            weakness_scores: { type_safety: 0.3, testing_reliability: 0.5 },
            quality_score: 7,
          },
        } as never),
      );

      expect(Object.keys(stored).sort()).toEqual([
        'overall_code_quality',
        'testing_reliability',
        'type_safety',
      ]);
    });
  });

  describe('top weaknesses', () => {
    it('passes an explicit list through untouched', async () => {
      const top_weaknesses = [
        { category: 'type_safety', score: 0.9, evidence: ['x'], priority: 'high' },
      ];
      const { service, stored } = build();

      await service.ingestRepositoryAnalysis(
        event({
          summary: { weakness_scores: { type_safety: 0.9 }, quality_score: 7, top_weaknesses },
        } as never),
      );

      expect(stored.overall_code_quality.statistics.topWeaknesses).toEqual(
        top_weaknesses,
      );
    });

    it('derives the three highest-scoring weaknesses when none are given', async () => {
      const { service, stored } = build();

      await service.ingestRepositoryAnalysis(
        event({
          summary: {
            weakness_scores: { a: 0.1, b: 0.9, c: 0.5, d: 0.8 },
            quality_score: 7,
          },
        } as never),
      );

      expect(
        stored.overall_code_quality.statistics.topWeaknesses.map(
          (item: any) => item.category,
        ),
      ).toEqual(['b', 'd', 'c']);
    });

    it.each([
      [0.9, 'high'],
      [0.75, 'high'],
      [0.6, 'medium'],
      [0.45, 'medium'],
      [0.44, 'low'],
    ])('bands a derived score of %s as %s priority', async (score, priority) => {
      const { service, stored } = build();

      await service.ingestRepositoryAnalysis(
        event({
          summary: { weakness_scores: { only: score }, quality_score: 7 },
        } as never),
      );

      expect(
        stored.overall_code_quality.statistics.topWeaknesses[0].priority,
      ).toBe(priority);
    });
  });

  describe('recommendations', () => {
    it('passes an explicit list through untouched', async () => {
      const recommendations = [
        { weakness: 'type_safety', action: 'Do a thing', learning_query: 'ts' },
      ];
      const { service, stored } = build();

      await service.ingestRepositoryAnalysis(
        event({
          summary: { weakness_scores: {}, quality_score: 7, recommendations },
        } as never),
      );

      expect(stored.overall_code_quality.statistics.recommendations).toEqual(
        recommendations,
      );
    });

    it('synthesises up to five from the learning resources', async () => {
      const { service, stored } = build();
      const learning_resources = Array.from({ length: 7 }, (_, index) => ({
        skill: `skill-${index}`,
        title: `Course ${index}`,
        type: 'guide',
        url: `https://example.com/${index}`,
      }));

      await service.ingestRepositoryAnalysis(
        event({
          summary: { weakness_scores: {}, quality_score: 7, learning_resources },
        } as never),
      );

      const derived = stored.overall_code_quality.statistics.recommendations;
      expect(derived).toHaveLength(5);
      expect(derived[0]).toEqual({
        weakness: 'skill-0',
        action: 'Review Course 0',
        learning_query: 'https://example.com/0',
      });
    });

    it('yields an empty list when there is nothing to synthesise from', async () => {
      const { service, stored } = build();

      await service.ingestRepositoryAnalysis(event());

      expect(stored.overall_code_quality.statistics.recommendations).toEqual([]);
    });
  });

  describe('statistics payload', () => {
    it('records repository context alongside the score', async () => {
      const { service, stored } = build();

      await service.ingestRepositoryAnalysis(
        event({
          summary: { weakness_scores: { type_safety: 0.3 }, quality_score: 7 },
        } as never),
      );

      expect(stored.type_safety.statistics).toMatchObject({
        repositoryId: 'repo-1',
        repoName: 'devlab/platform',
        category: 'type_safety',
        weaknessScore: 0.3,
      });
    });

    it('merges event metadata into the stored statistics', async () => {
      const { service, stored } = build();

      await service.ingestRepositoryAnalysis(
        event({ metadata: { commitSha: 'abc123' } }),
      );

      expect(stored.overall_code_quality.statistics.commitSha).toBe('abc123');
    });

    it('preserves statistics already stored for the skill', async () => {
      const { service, stored } = build({
        type_safety: { proficiency: 4, commitCount: 1, statistics: { firstSeen: '2023' } },
      });

      await service.ingestRepositoryAnalysis(
        event({
          summary: { weakness_scores: { type_safety: 0.3 }, quality_score: 7 },
        } as never),
      );

      expect(stored.type_safety.statistics.firstSeen).toBe('2023');
    });

    it('stamps lastUsed from analyzedAt', async () => {
      const { service, stored } = build();

      await service.ingestRepositoryAnalysis(
        event({ analyzedAt: '2024-03-09T12:00:00Z' }),
      );

      expect(stored.overall_code_quality.lastUsed).toEqual(
        new Date('2024-03-09T12:00:00Z'),
      );
    });

    it('falls back to now when the event carries no timestamp', async () => {
      const { service, stored } = build();

      await service.ingestRepositoryAnalysis(event({ analyzedAt: undefined }));

      expect(stored.overall_code_quality.lastUsed).toBeInstanceOf(Date);
    });
  });
});

describe('read paths', () => {
  it('findAll delegates to the skill model', async () => {
    const { service, skillModel } = build();

    await expect(service.findAll()).resolves.toEqual([]);
    expect(skillModel.find).toHaveBeenCalled();
  });

  it('getDeveloperSkills filters by developer', async () => {
    const { service, developerSkillModel } = build();

    await service.getDeveloperSkills('dev-1');

    expect(developerSkillModel.find).toHaveBeenCalledWith({ developerId: 'dev-1' });
  });

  it('updateDeveloperSkill upserts on the developer/skill pair', async () => {
    const { service, developerSkillModel } = build();

    await service.updateDeveloperSkill('dev-1', 'type_safety', { proficiency: 8 });

    expect(developerSkillModel.findOneAndUpdate).toHaveBeenCalledWith(
      { developerId: 'dev-1', skillName: 'type_safety' },
      { $set: { proficiency: 8 } },
      { new: true, upsert: true },
    );
  });
});
