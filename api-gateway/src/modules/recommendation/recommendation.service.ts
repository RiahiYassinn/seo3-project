import { HttpException, Injectable } from "@nestjs/common";
import axios, { AxiosError } from "axios";

@Injectable()
export class RecommendationService {
  private readonly baseUrl =
    process.env.RECOMMENDATION_SERVICE_HTTP_URL ||
    process.env.RECOMMENDATION_SERVICE_URL?.replace(/^tcp:/, "http:") ||
    "http://localhost:3004";

  private handleError(error: unknown): never {
    const axiosError = error as AxiosError<{ message?: string }>;
    const status = axiosError.response?.status || 500;
    const message =
      axiosError.response?.data?.message ||
      axiosError.message ||
      "Recommendation service request failed";

    throw new HttpException(message, status);
  }

  async getMyRecommendations(userId: string) {
    try {
      const response = await axios.get(
        `${this.baseUrl}/recommendations/developer/${userId}`,
      );
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

  async getAvailableMentors() {
    try {
      const response = await axios.get(
        `${this.baseUrl}/recommendations/mentors/available`,
      );
      return response.data;
    } catch (error) {
      this.handleError(error);
    }
  }

  async getMentorRequests(mentorId: string) {
    try {
      const response = await axios.get(
        `${this.baseUrl}/recommendations/mentor/${mentorId}/requests`,
      );
      return response.data;
    } catch (error) {
      this.handleError(error);
    }
  }

  async getMyMentorRequests(userId: string) {
    try {
      const response = await axios.get(
        `${this.baseUrl}/recommendations/developer/${userId}/mentor-requests`,
      );
      return response.data;
    } catch (error) {
      this.handleError(error);
    }
  }

  async requestMentor(
    recommendationId: string,
    mentorId: string,
    developerId: string,
  ) {
    try {
      const response = await axios.post(
        `${this.baseUrl}/recommendations/${recommendationId}/request-mentor`,
        { mentorId, developerId },
      );
      return response.data;
    } catch (error) {
      this.handleError(error);
    }
  }

  async acceptMentorRequest(requestId: string, mentorId: string) {
    try {
      const response = await axios.post(
        `${this.baseUrl}/recommendations/mentor-requests/${requestId}/accept`,
        { mentorId },
      );
      return response.data;
    } catch (error) {
      this.handleError(error);
    }
  }

  async declineMentorRequest(requestId: string, mentorId: string) {
    try {
      const response = await axios.post(
        `${this.baseUrl}/recommendations/mentor-requests/${requestId}/decline`,
        { mentorId },
      );
      return response.data;
    } catch (error) {
      this.handleError(error);
    }
  }

  async getMentorQueue(userId: string) {
    try {
      const response = await axios.get(
        `${this.baseUrl}/recommendations/mentor/${userId}/queue`,
      );
      return response.data;
    } catch (error) {
      this.handleError(error);
    }
  }

  async getRecommendationById(
    recommendationId: string,
    requesterId: string,
    requesterRole: string,
    contributorLogin?: string,
  ) {
    try {
      const response = await axios.get(
        `${this.baseUrl}/recommendations/${recommendationId}`,
        {
          params: {
            requesterId,
            requesterRole,
            contributorLogin,
          },
        },
      );
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

  async scheduleMentorshipSession(
    recommendationId: string,
    mentorId: string,
    scheduledAt: string,
    note?: string,
    mode?: "remote" | "onsite",
    location?: string,
  ) {
    try {
      const response = await axios.post(
        `${this.baseUrl}/recommendations/${recommendationId}/schedule-session`,
        { mentorId, scheduledAt, note, mode, location },
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

  async acknowledgeRecommendation(
    recommendationId: string,
    requesterId: string,
    requesterRole: string,
    contributorLogin?: string,
  ) {
    try {
      const response = await axios.post(
        `${this.baseUrl}/recommendations/${recommendationId}/acknowledge`,
        { requesterId, requesterRole, contributorLogin },
      );
      return response.data;
    } catch (error) {
      this.handleError(error);
    }
  }

  async getQuiz(
    recommendationId: string,
    developerId: string,
    contributorLogin?: string,
  ) {
    try {
      const response = await axios.get(
        `${this.baseUrl}/recommendations/${recommendationId}/quiz/${developerId}`,
        { params: contributorLogin ? { contributorLogin } : {} },
      );
      return response.data;
    } catch (error) {
      this.handleError(error);
    }
  }

  async generateQuiz(
    recommendationId: string,
    developerId: string,
    contributorLogin?: string,
    regenerate = false,
  ) {
    try {
      const response = await axios.post(
        `${this.baseUrl}/recommendations/${recommendationId}/quiz/generate`,
        { developerId, contributorLogin, regenerate },
      );
      return response.data;
    } catch (error) {
      this.handleError(error);
    }
  }

  async submitQuiz(
    recommendationId: string,
    developerId: string,
    contributorLogin: string | undefined,
    answers: Array<{ questionId: string; selectedIndex: number }>,
  ) {
    try {
      const response = await axios.post(
        `${this.baseUrl}/recommendations/${recommendationId}/quiz/submit`,
        { developerId, contributorLogin, answers },
      );
      return response.data;
    } catch (error) {
      this.handleError(error);
    }
  }
}