import { Injectable, Logger } from '@nestjs/common';
import * as https from 'node:https';
import { URL, URLSearchParams } from 'node:url';

export interface TeamsMeeting {
  joinUrl: string;
  meetingId: string | null;
}

/**
 * Creates real Microsoft Teams meetings through Microsoft Graph using the
 * client-credentials flow.
 *
 * Requires an Azure app registration with the application permission
 * `OnlineMeetings.ReadWrite.All` plus an application access policy granting it
 * rights over the organizer account:
 *
 *   MS_TEAMS_TENANT_ID, MS_TEAMS_CLIENT_ID, MS_TEAMS_CLIENT_SECRET,
 *   MS_TEAMS_ORGANIZER_ID  (object id or UPN of the organiser account)
 *
 * When those are absent the service returns null rather than inventing a link —
 * a dead meeting URL in an invitation is worse than no URL at all.
 */
@Injectable()
export class TeamsMeetingService {
  private readonly logger = new Logger(TeamsMeetingService.name);

  private readonly tenantId = process.env.MS_TEAMS_TENANT_ID || '';
  private readonly clientId = process.env.MS_TEAMS_CLIENT_ID || '';
  private readonly clientSecret = process.env.MS_TEAMS_CLIENT_SECRET || '';
  private readonly organizerId = process.env.MS_TEAMS_ORGANIZER_ID || '';

  isConfigured(): boolean {
    return Boolean(
      this.tenantId && this.clientId && this.clientSecret && this.organizerId,
    );
  }

  async createMeeting(params: {
    subject: string;
    startDateTime: string;
    endDateTime: string;
  }): Promise<TeamsMeeting | null> {
    if (!this.isConfigured()) {
      this.logger.warn(
        'Microsoft Teams integration is not configured; scheduling without a join link',
      );
      return null;
    }

    try {
      const accessToken = await this.fetchAccessToken();
      const meeting = await this.request<{
        id?: string;
        joinWebUrl?: string;
        joinUrl?: string;
      }>(
        'POST',
        `https://graph.microsoft.com/v1.0/users/${encodeURIComponent(
          this.organizerId,
        )}/onlineMeetings`,
        {
          subject: params.subject,
          startDateTime: params.startDateTime,
          endDateTime: params.endDateTime,
        },
        { Authorization: `Bearer ${accessToken}` },
      );

      const joinUrl = meeting.joinWebUrl || meeting.joinUrl || '';
      if (!joinUrl) {
        this.logger.error('Graph returned a meeting without a join URL');
        return null;
      }

      return { joinUrl, meetingId: meeting.id || null };
    } catch (error) {
      this.logger.error(
        `Failed to create Teams meeting: ${
          error instanceof Error ? error.message : error
        }`,
      );
      return null;
    }
  }

  private async fetchAccessToken(): Promise<string> {
    const body = new URLSearchParams({
      client_id: this.clientId,
      client_secret: this.clientSecret,
      scope: 'https://graph.microsoft.com/.default',
      grant_type: 'client_credentials',
    }).toString();

    const response = await this.request<{ access_token?: string }>(
      'POST',
      `https://login.microsoftonline.com/${this.tenantId}/oauth2/v2.0/token`,
      body,
      { 'Content-Type': 'application/x-www-form-urlencoded' },
    );

    if (!response.access_token) {
      throw new Error('Microsoft identity platform returned no access token');
    }

    return response.access_token;
  }

  private request<T>(
    method: string,
    url: string,
    body: Record<string, any> | string,
    extraHeaders: Record<string, string> = {},
  ): Promise<T> {
    return new Promise((resolve, reject) => {
      const isForm = typeof body === 'string';
      const payload = isForm ? body : JSON.stringify(body);
      const target = new URL(url);

      const req = https.request(
        {
          method,
          protocol: target.protocol,
          hostname: target.hostname,
          port: target.port || 443,
          path: `${target.pathname}${target.search}`,
          headers: {
            'Content-Type': 'application/json',
            'Content-Length': Buffer.byteLength(payload),
            ...extraHeaders,
          },
        },
        (res) => {
          let raw = '';
          res.on('data', (chunk) => {
            raw += chunk;
          });
          res.on('end', () => {
            const status = res.statusCode || 0;
            if (status < 200 || status >= 300) {
              reject(new Error(`Graph request failed (${status}): ${raw.slice(0, 400)}`));
              return;
            }

            try {
              resolve(raw ? JSON.parse(raw) : ({} as T));
            } catch (parseError) {
              reject(parseError);
            }
          });
        },
      );

      req.on('error', reject);
      req.write(payload);
      req.end();
    });
  }
}
