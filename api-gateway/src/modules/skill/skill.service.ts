import { HttpException, Injectable } from '@nestjs/common';
import axios, { AxiosError } from 'axios';

@Injectable()
export class SkillService {
  private readonly baseUrl =
    process.env.SKILL_SERVICE_HTTP_URL ||
    process.env.SKILL_SERVICE_URL?.replace(/^tcp:/, 'http:') ||
    'http://localhost:3011';

  private handleError(error: unknown): never {
    const axiosError = error as AxiosError<{ message?: string }>;
    const status = axiosError.response?.status || 500;
    const message =
      axiosError.response?.data?.message ||
      axiosError.message ||
      'Skill service request failed';

    throw new HttpException(message, status);
  }

  async findAll() {
    try {
      const response = await axios.get(`${this.baseUrl}/skills`);
      return response.data;
    } catch (error) {
      this.handleError(error);
    }
  }

  async getDeveloperSkills(developerId: string) {
    try {
      const response = await axios.get(`${this.baseUrl}/skills/developer/${developerId}`);
      return response.data;
    } catch (error) {
      this.handleError(error);
    }
  }

  async getSkillGraph(developerId: string) {
    return {
      developerId,
      nodes: [],
      edges: [],
    };
  }

  async getLearningPaths(developerId: string) {
    const skills = await this.getDeveloperSkills(developerId);

    return (skills || [])
      .map((skill: any) => skill?.statistics?.recommendation || skill?.statistics?.recommendations)
      .flat()
      .filter(Boolean);
  }
}
