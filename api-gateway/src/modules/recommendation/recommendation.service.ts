import { HttpException, Injectable } from '@nestjs/common';
import axios, { AxiosError } from 'axios';

@Injectable()
export class RecommendationService {
  private readonly baseUrl =
    process.env.RECOMMENDATION_SERVICE_HTTP_URL ||
    process.env.RECOMMENDATION_SERVICE_URL?.replace(/^tcp:/, 'http:') ||
    'http://localhost:3004';

  private handleError(error: unknown): never {
    const axiosError = error as AxiosError<{ message?: string }>;
    const status = axiosError.response?.status || 500;
    const message =
      axiosError.response?.data?.message ||
      axiosError.message ||
      'Recommendation service request failed';

    throw new HttpException(message, status);
  }

  async getMyRecommendations(userId: string) {
    try {
      const response = await axios.get(`${this.baseUrl}/recommendations/developer/${userId}`);
      return response.data;
    } catch (error) {
      this.handleError(error);
    }
  }

  async getRecommendationsForContributorLogin(contributorLogin: string) {
    try {
      const response = await axios.get(
        `${this.baseUrl}/recommendations/contributor/${encodeURIComponent(contributorLogin)}`,
      );
      return response.data;
    } catch (error) {
      this.handleError(error);
    }
  }

  async getRepositoryRecommendations(userId: string, repositoryId: string) {
    try {
      const response = await axios.get(
        `${this.baseUrl}/recommendations/developer/${userId}/repository/${repositoryId}`,
      );
      return response.data;
    } catch (error) {
      this.handleError(error);
    }
  }

  async getContributorRecommendation(
    userId: string,
    repositoryId: string,
    contributorLogin: string,
  ) {
    try {
      const response = await axios.get(
        `${this.baseUrl}/recommendations/developer/${userId}/repository/${repositoryId}/contributor/${encodeURIComponent(
          contributorLogin,
        )}`,
      );
      return response.data;
    } catch (error) {
      this.handleError(error);
    }
  }

  async generateContributorRecommendation(
    userId: string,
    repositoryId: string,
    contributorLogin: string,
  ) {
    try {
      const response = await axios.post(
        `${this.baseUrl}/recommendations/developer/${userId}/repository/${repositoryId}/contributor/${encodeURIComponent(
          contributorLogin,
        )}/generate`,
      );
      return response.data;
    } catch (error) {
      this.handleError(error);
    }
  }

  async getMentorQueue(userId: string) {
    try {
      const response = await axios.get(`${this.baseUrl}/recommendations/mentor/${userId}/queue`);
      return response.data;
    } catch (error) {
      this.handleError(error);
    }
  }

  async assignMentor(recommendationId: string, mentorId: string) {
    try {
      const response = await axios.post(
        `${this.baseUrl}/recommendations/${recommendationId}/assign`,
        { mentorId },
      );
      return response.data;
    } catch (error) {
      this.handleError(error);
    }
  }

  async regenerateRecommendation(recommendationId: string) {
    try {
      const response = await axios.post(
        `${this.baseUrl}/recommendations/${recommendationId}/regenerate`,
      );
      return response.data;
    } catch (error) {
      this.handleError(error);
    }
  }

  async acknowledgeRecommendation(recommendationId: string, developerId: string) {
    try {
      const response = await axios.post(
        `${this.baseUrl}/recommendations/${recommendationId}/acknowledge`,
        { developerId },
      );
      return response.data;
    } catch (error) {
      this.handleError(error);
    }
  }
}
