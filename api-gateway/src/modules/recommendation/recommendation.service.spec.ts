import { HttpException } from '@nestjs/common';
import axios from 'axios';
import { RecommendationService } from './recommendation.service';

jest.mock('axios');

const axiosMock = axios as jest.Mocked<typeof axios>;

describe('RecommendationService', () => {
  let service: RecommendationService;

  beforeEach(() => {
    jest.clearAllMocks();
    axiosMock.get.mockResolvedValue({ data: { ok: true } } as never);
    axiosMock.post.mockResolvedValue({ data: { ok: true } } as never);
    service = new RecommendationService();
  });

  const lastGetUrl = () => axiosMock.get.mock.calls.at(-1)?.[0] as string;
  const lastPost = () => axiosMock.post.mock.calls.at(-1) as [string, unknown?];

  describe('URL construction', () => {
    it('targets the downstream service and unwraps response.data', async () => {
      await expect(service.getMyRecommendations('dev-1')).resolves.toEqual({
        ok: true,
      });
      expect(lastGetUrl()).toBe(
        'http://localhost:3004/recommendations/developer/dev-1',
      );
    });

    it('nests repository and contributor segments in the right order', async () => {
      await service.getContributorRecommendation('dev-1', 'repo-9', 'octocat');

      expect(lastGetUrl()).toBe(
        'http://localhost:3004/recommendations/developer/dev-1/repository/repo-9/contributor/octocat',
      );
    });

    it.each([
      ['a slash', 'org/team', 'org%2Fteam'],
      ['a space', 'ada lovelace', 'ada%20lovelace'],
      ['a question mark', 'who?', 'who%3F'],
    ])(
      'percent-encodes a contributor login containing %s',
      async (_label, login, encoded) => {
        await service.getRecommendationsForContributorLogin(login);

        expect(lastGetUrl()).toBe(
          `http://localhost:3004/recommendations/contributor/${encoded}`,
        );
      },
    );

    it('passes requester identity as query params, not path segments', async () => {
      await service.getRecommendationById('rec-1', 'user-2', 'admin', 'octocat');

      expect(axiosMock.get).toHaveBeenCalledWith(
        'http://localhost:3004/recommendations/rec-1',
        {
          params: {
            requesterId: 'user-2',
            requesterRole: 'admin',
            contributorLogin: 'octocat',
          },
        },
      );
    });

    it('sends an empty params object when no contributor is supplied to getQuiz', async () => {
      await service.getQuiz('rec-1', 'dev-1');

      expect(axiosMock.get).toHaveBeenCalledWith(
        'http://localhost:3004/recommendations/rec-1/quiz/dev-1',
        { params: {} },
      );
    });
  });

  describe('request bodies', () => {
    it('defaults quiz generation to a non-regenerating request', async () => {
      await service.generateQuiz('rec-1', 'dev-1');

      expect(lastPost()[1]).toEqual({
        developerId: 'dev-1',
        contributorLogin: undefined,
        regenerate: false,
      });
    });

    it('forwards quiz answers verbatim', async () => {
      const answers = [{ questionId: 'q1', selectedIndex: 2 }];

      await service.submitQuiz('rec-1', 'dev-1', 'octocat', answers);

      expect(lastPost()[1]).toEqual({
        developerId: 'dev-1',
        contributorLogin: 'octocat',
        answers,
      });
    });

    it('forwards optional session fields', async () => {
      await service.scheduleMentorshipSession(
        'rec-1',
        'mentor-1',
        '2024-05-01T10:00:00Z',
        'kickoff',
        'remote',
      );

      expect(lastPost()[1]).toEqual({
        mentorId: 'mentor-1',
        scheduledAt: '2024-05-01T10:00:00Z',
        note: 'kickoff',
        mode: 'remote',
        location: undefined,
      });
    });

    it('posts with no body when the downstream route takes none', async () => {
      await service.regenerateRecommendation('rec-1');

      expect(lastPost()).toEqual([
        'http://localhost:3004/recommendations/rec-1/regenerate',
      ]);
    });
  });

  describe('error translation', () => {
    it('preserves the downstream status and message', async () => {
      axiosMock.get.mockRejectedValueOnce({
        response: { status: 404, data: { message: 'No recommendation' } },
        message: 'Request failed with status code 404',
      });

      await expect(service.getMyRecommendations('dev-1')).rejects.toMatchObject({
        status: 404,
        message: 'No recommendation',
      });
    });

    it('falls back to the axios message when the body carries none', async () => {
      axiosMock.get.mockRejectedValueOnce({
        response: { status: 502, data: {} },
        message: 'socket hang up',
      });

      await expect(service.getMyRecommendations('dev-1')).rejects.toMatchObject({
        status: 502,
        message: 'socket hang up',
      });
    });

    it('reports 500 for a transport error with no response', async () => {
      axiosMock.post.mockRejectedValueOnce(new Error('ECONNREFUSED'));

      const error = await service
        .assignMentor('rec-1', 'mentor-1')
        .catch((caught) => caught);

      expect(error).toBeInstanceOf(HttpException);
      expect(error.getStatus()).toBe(500);
      expect(error.message).toBe('ECONNREFUSED');
    });

    it('uses a generic message when the error carries nothing usable', async () => {
      axiosMock.get.mockRejectedValueOnce({});

      await expect(service.getAvailableMentors()).rejects.toMatchObject({
        status: 500,
        message: 'Recommendation service request failed',
      });
    });
  });

  describe('base URL resolution', () => {
    const originalEnv = { ...process.env };

    afterEach(() => {
      process.env = { ...originalEnv };
    });

    it('prefers the explicit HTTP url', async () => {
      process.env.RECOMMENDATION_SERVICE_HTTP_URL = 'http://reco:9000';

      await new RecommendationService().getAvailableMentors();

      expect(lastGetUrl()).toBe('http://reco:9000/recommendations/mentors/available');
    });

    it('rewrites a tcp:// microservice url to http://', async () => {
      delete process.env.RECOMMENDATION_SERVICE_HTTP_URL;
      process.env.RECOMMENDATION_SERVICE_URL = 'tcp://reco:3004';

      await new RecommendationService().getAvailableMentors();

      expect(lastGetUrl()).toBe('http://reco:3004/recommendations/mentors/available');
    });
  });
});
