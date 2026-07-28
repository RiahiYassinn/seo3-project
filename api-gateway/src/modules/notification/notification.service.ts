import { HttpException, Injectable } from '@nestjs/common';
import axios, { AxiosError } from 'axios';
import { CreateNotificationDto } from './dto/create-notification.dto';

@Injectable()
export class NotificationService {
  private readonly baseUrl =
    process.env.NOTIFICATION_SERVICE_HTTP_URL ||
    process.env.NOTIFICATION_SERVICE_URL?.replace(/^tcp:/, 'http:') ||
    'http://localhost:3005';

  async getMyNotifications(userId: string, role: string, limit = 50) {
    try {
      const response = await axios.get(
        `${this.baseUrl}/notifications/user/${userId}`,
        {
          params: {
            role: this.normalizeRole(role),
            limit,
          },
        },
      );

      return response.data;
    } catch (error) {
      this.handleError(error);
    }
  }

  async sendNotification(dto: CreateNotificationDto) {
    try {
      const response = await axios.post(
        `${this.baseUrl}/notifications/send`,
        dto,
      );

      return response.data;
    } catch (error) {
      this.handleError(error);
    }
  }

  async markAsRead(notificationId: string, userId: string, role: string) {
    try {
      const response = await axios.post(
        `${this.baseUrl}/notifications/${notificationId}/read`,
        {
          userId,
          role: this.normalizeRole(role),
        },
      );

      return response.data;
    } catch (error) {
      this.handleError(error);
    }
  }

  async markAsUnread(notificationId: string, userId: string, role: string) {
    try {
      const response = await axios.post(
        `${this.baseUrl}/notifications/${notificationId}/unread`,
        {
          userId,
          role: this.normalizeRole(role),
        },
      );

      return response.data;
    } catch (error) {
      this.handleError(error);
    }
  }

  async dismiss(notificationId: string, userId: string, role: string) {
    try {
      const response = await axios.post(
        `${this.baseUrl}/notifications/${notificationId}/dismiss`,
        {
          userId,
          role: this.normalizeRole(role),
        },
      );

      return response.data;
    } catch (error) {
      this.handleError(error);
    }
  }

  async dismissMany(ids: string[], userId: string, role: string) {
    try {
      const response = await axios.post(
        `${this.baseUrl}/notifications/dismiss`,
        {
          ids,
          userId,
          role: this.normalizeRole(role),
        },
      );

      return response.data;
    } catch (error) {
      this.handleError(error);
    }
  }

  async markAllAsRead(userId: string, role: string) {
    try {
      const response = await axios.post(
        `${this.baseUrl}/notifications/read-all`,
        {
          userId,
          role: this.normalizeRole(role),
        },
      );

      return response.data;
    } catch (error) {
      this.handleError(error);
    }
  }

  private normalizeRole(role?: string | null) {
    return String(role || '')
      .trim()
      .toLowerCase()
      .replace(/[-\s]+/g, '_');
  }

  private handleError(error: unknown): never {
    const axiosError = error as AxiosError<{ message?: string }>;
    const status = axiosError.response?.status || 500;
    const message =
      axiosError.response?.data?.message ||
      axiosError.message ||
      'Notification service request failed';

    throw new HttpException(message, status);
  }
}
