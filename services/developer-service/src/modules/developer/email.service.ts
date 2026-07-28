import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import * as nodemailer from 'nodemailer';

export type MentorshipSessionMode = 'remote' | 'onsite';

export interface MentorshipSessionEmail {
  topic: string;
  scheduledAt: string;
  timeZone?: string;
  mode: MentorshipSessionMode;
  location?: string | null;
  joinUrl?: string | null;
  note?: string | null;
  mentorName: string;
}

@Injectable()
export class EmailService implements OnModuleInit {
  private readonly logger = new Logger(EmailService.name);
  private readonly transporter: nodemailer.Transporter;

  constructor() {
    // Gmail App Passwords are displayed with spaces (e.g. "abcd efgh ijkl mnop")
    // but SMTP auth requires them without spaces.
    const smtpPass = (process.env.SMTP_PASSWORD || '').replace(/\s/g, '');

    this.transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST || 'smtp.gmail.com',
      port: parseInt(process.env.SMTP_PORT || '587'),
      secure: false, // STARTTLS on port 587
      auth: {
        user: process.env.SMTP_USER,
        pass: smtpPass,
      },
    });
  }

  /**
   * Checks the SMTP credentials at boot. Every send path swallows its errors so
   * a mail outage cannot break registration, which means bad credentials are
   * otherwise invisible until someone notices missing mail — this makes the
   * failure loud and immediate instead.
   */
  async onModuleInit() {
    if (!process.env.SMTP_USER || !process.env.SMTP_PASSWORD) {
      this.logger.warn(
        'SMTP_USER / SMTP_PASSWORD are not set — no email will be sent',
      );
      return;
    }

    try {
      await this.transporter.verify();
      this.logger.log(`SMTP ready as ${process.env.SMTP_USER}`);
    } catch (error: any) {
      this.logger.error(
        `SMTP credentials rejected — emails will silently fail until this is fixed: ${error?.message}`,
      );
    }
  }

  async sendVerificationEmail(to: string, name: string, token: string): Promise<void> {
    const verifyUrl = `${process.env.FRONTEND_VERIFY_EMAIL_URL || 'http://localhost:3000/verify-email'}?token=${token}`;
    const from = process.env.EMAIL_FROM || process.env.SMTP_USER;

    await this.transporter.sendMail({
      from: `"Dev Lab Platform" <${from}>`,
      to,
      subject: 'Verify your email address',
      html: `
        <!DOCTYPE html>
        <html>
          <body style="font-family: Arial, sans-serif; background: #f4f4f4; padding: 20px;">
            <div style="max-width: 560px; margin: 0 auto; background: #fff; border-radius: 8px; padding: 32px; box-shadow: 0 2px 8px rgba(0,0,0,0.1);">
              <h2 style="color: #1a1a1a; margin-top: 0;">Verify your email</h2>
              <p style="color: #444;">Hi ${name},</p>
              <p style="color: #444;">Thanks for signing up for Dev Lab Platform. Click the button below to verify your email address. This link expires in 24 hours.</p>
              <div style="text-align: center; margin: 32px 0;">
                <a href="${verifyUrl}"
                   style="background: #6366f1; color: #fff; padding: 12px 28px; border-radius: 6px; text-decoration: none; font-weight: bold; font-size: 15px;">
                  Verify Email
                </a>
              </div>
              <p style="color: #888; font-size: 13px;">Or copy this link into your browser:<br/>
                <a href="${verifyUrl}" style="color: #6366f1; word-break: break-all;">${verifyUrl}</a>
              </p>
              <hr style="border: none; border-top: 1px solid #eee; margin: 24px 0;"/>
              <p style="color: #aaa; font-size: 12px;">If you didn't create an account, you can safely ignore this email.</p>
            </div>
          </body>
        </html>
      `,
    });

    this.logger.log(`Verification email sent to ${to}`);
  }

  async sendPasswordResetEmail(to: string, name: string, token: string): Promise<void> {
    const resetUrl = `${process.env.FRONTEND_RESET_PASSWORD_URL || 'http://localhost:3000/reset-password'}?token=${token}`;
    const from = process.env.EMAIL_FROM || process.env.SMTP_USER;

    await this.transporter.sendMail({
      from: `"Dev Lab Platform" <${from}>`,
      to,
      subject: 'Reset your password',
      html: `
        <!DOCTYPE html>
        <html>
          <body style="font-family: Arial, sans-serif; background: #f4f4f4; padding: 20px;">
            <div style="max-width: 560px; margin: 0 auto; background: #fff; border-radius: 8px; padding: 32px; box-shadow: 0 2px 8px rgba(0,0,0,0.1);">
              <h2 style="color: #1a1a1a; margin-top: 0;">Reset your password</h2>
              <p style="color: #444;">Hi ${name},</p>
              <p style="color: #444;">We received a request to reset your password. Click the button below to choose a new one. This link expires in 1 hour.</p>
              <div style="text-align: center; margin: 32px 0;">
                <a href="${resetUrl}"
                   style="background: #6366f1; color: #fff; padding: 12px 28px; border-radius: 6px; text-decoration: none; font-weight: bold; font-size: 15px;">
                  Reset Password
                </a>
              </div>
              <p style="color: #888; font-size: 13px;">Or copy this link into your browser:<br/>
                <a href="${resetUrl}" style="color: #6366f1; word-break: break-all;">${resetUrl}</a>
              </p>
              <hr style="border: none; border-top: 1px solid #eee; margin: 24px 0;"/>
              <p style="color: #aaa; font-size: 12px;">If you didn't request a password reset, you can safely ignore this email.</p>
            </div>
          </body>
        </html>
      `,
    });

    this.logger.log(`Password reset email sent to ${to}`);
  }

  async sendCredentialsEmail(to: string, name: string, username: string, password: string): Promise<void> {
    const from = process.env.EMAIL_FROM || process.env.SMTP_USER;

    await this.transporter.sendMail({
      from: `"Dev Lab Platform" <${from}>`,
      to,
      subject: 'Your account credentials',
      html: `
      <!DOCTYPE html>
      <html>
        <body style="font-family: Arial, sans-serif; background: #f4f4f4; padding: 20px;">
          <div style="max-width: 560px; margin: 0 auto; background: #fff; border-radius: 8px; padding: 32px; box-shadow: 0 2px 8px rgba(0,0,0,0.1);">
            <h2 style="color: #1a1a1a; margin-top: 0;">Welcome to Dev Lab Platform 🎉</h2>
            <p style="color: #444;">Hi ${name},</p>
            <p style="color: #444;">Your account has been created. Here are your login credentials:</p>
            <div style="background: #f9f9f9; border: 1px solid #e0e0e0; border-radius: 6px; padding: 16px 24px; margin: 24px 0;">
              <p style="margin: 8px 0; color: #333;"><strong>Username:</strong> ${username}</p>
              <p style="margin: 8px 0; color: #333;"><strong>Password:</strong> ${password}</p>
            </div>
            <p style="color: #e53e3e; font-size: 13px;">⚠️ Please change your password after your first login for security.</p>
            <hr style="border: none; border-top: 1px solid #eee; margin: 24px 0;"/>
            <p style="color: #aaa; font-size: 12px;">If you didn't register for this account, please contact support immediately.</p>
          </div>
        </body>
      </html>
    `,
    });

    this.logger.log(`Credentials email sent to ${to}`);
  }

  /* --------------------------- Mentoring sessions --------------------------- */

  private formatSessionWhen(scheduledAt: string, timeZone?: string): string {
    const date = new Date(scheduledAt);
    if (Number.isNaN(date.getTime())) {
      return scheduledAt;
    }

    return date.toLocaleString('en-US', {
      dateStyle: 'full',
      timeStyle: 'short',
      timeZone: timeZone || 'UTC',
    });
  }

  private sessionDetailsBlock(params: MentorshipSessionEmail): string {
    const when = this.formatSessionWhen(params.scheduledAt, params.timeZone);
    const rows: string[] = [
      `<p style="margin: 8px 0; color: #333;"><strong>Topic:</strong> ${params.topic}</p>`,
      `<p style="margin: 8px 0; color: #333;"><strong>When:</strong> ${when} (${params.timeZone || 'UTC'})</p>`,
      `<p style="margin: 8px 0; color: #333;"><strong>Mentor:</strong> ${params.mentorName}</p>`,
    ];

    if (params.mode === 'onsite') {
      rows.push(
        `<p style="margin: 8px 0; color: #333;"><strong>Where:</strong> ${
          params.location || 'Location to be confirmed by your mentor'
        }</p>`,
      );
    } else {
      rows.push(
        `<p style="margin: 8px 0; color: #333;"><strong>Where:</strong> Online (Microsoft Teams)</p>`,
      );
    }

    if (params.note) {
      rows.push(
        `<p style="margin: 8px 0; color: #333;"><strong>Agenda:</strong> ${params.note}</p>`,
      );
    }

    return `<div style="background: #f9f9f9; border: 1px solid #e0e0e0; border-radius: 6px; padding: 16px 24px; margin: 24px 0;">${rows.join(
      '',
    )}</div>`;
  }

  private joinBlock(params: MentorshipSessionEmail): string {
    if (params.mode !== 'remote') {
      return '';
    }

    if (params.joinUrl) {
      return `
        <div style="text-align: center; margin: 28px 0;">
          <a href="${params.joinUrl}"
             style="background: #6366f1; color: #fff; padding: 12px 28px; border-radius: 6px; text-decoration: none; font-weight: bold; font-size: 15px;">
            Join the Teams meeting
          </a>
        </div>
        <p style="color: #888; font-size: 13px;">Or paste this link into your browser:<br/>
          <a href="${params.joinUrl}" style="color: #6366f1; word-break: break-all;">${params.joinUrl}</a>
        </p>`;
    }

    return `
      <p style="color: #b45309; background: #fffbeb; border: 1px solid #fde68a; border-radius: 6px; padding: 12px 16px; font-size: 14px;">
        The meeting link could not be generated automatically. Your mentor will send it before the session.
      </p>`;
  }

  async sendMentorshipSessionInvite(
    params: MentorshipSessionEmail & { recipientName: string; to: string },
  ): Promise<void> {
    const from = process.env.EMAIL_FROM || process.env.SMTP_USER;
    const modeLabel = params.mode === 'remote' ? 'Remote' : 'On-site';

    await this.transporter.sendMail({
      from: `"Dev Lab Platform" <${from}>`,
      to: params.to,
      subject: `Mentoring session scheduled — ${this.formatSessionWhen(
        params.scheduledAt,
        params.timeZone,
      )}`,
      html: `
        <!DOCTYPE html>
        <html>
          <body style="font-family: Arial, sans-serif; background: #f4f4f4; padding: 20px;">
            <div style="max-width: 560px; margin: 0 auto; background: #fff; border-radius: 8px; padding: 32px; box-shadow: 0 2px 8px rgba(0,0,0,0.1);">
              <p style="color: #6366f1; font-size: 12px; letter-spacing: 1px; text-transform: uppercase; margin: 0 0 8px;">${modeLabel} mentoring session</p>
              <h2 style="color: #1a1a1a; margin-top: 0;">Your session is booked</h2>
              <p style="color: #444;">Hi ${params.recipientName},</p>
              <p style="color: #444;">${params.mentorName} scheduled a mentoring session with you about the recommendation below.</p>
              ${this.sessionDetailsBlock(params)}
              ${this.joinBlock(params)}
              <hr style="border: none; border-top: 1px solid #eee; margin: 24px 0;"/>
              <p style="color: #aaa; font-size: 12px;">You'll get a reminder shortly before it starts.</p>
            </div>
          </body>
        </html>
      `,
    });

    this.logger.log(`Mentorship invite sent to ${params.to}`);
  }

  async sendMentorshipSessionReminder(
    params: MentorshipSessionEmail & {
      recipientName: string;
      to: string;
      minutesUntil: number;
    },
  ): Promise<void> {
    const from = process.env.EMAIL_FROM || process.env.SMTP_USER;

    await this.transporter.sendMail({
      from: `"Dev Lab Platform" <${from}>`,
      to: params.to,
      subject: `Reminder: mentoring session in ${params.minutesUntil} minutes`,
      html: `
        <!DOCTYPE html>
        <html>
          <body style="font-family: Arial, sans-serif; background: #f4f4f4; padding: 20px;">
            <div style="max-width: 560px; margin: 0 auto; background: #fff; border-radius: 8px; padding: 32px; box-shadow: 0 2px 8px rgba(0,0,0,0.1);">
              <p style="color: #6366f1; font-size: 12px; letter-spacing: 1px; text-transform: uppercase; margin: 0 0 8px;">Starting soon</p>
              <h2 style="color: #1a1a1a; margin-top: 0;">Your mentoring session starts in ${params.minutesUntil} minutes</h2>
              <p style="color: #444;">Hi ${params.recipientName},</p>
              ${this.sessionDetailsBlock(params)}
              ${this.joinBlock(params)}
              <hr style="border: none; border-top: 1px solid #eee; margin: 24px 0;"/>
              <p style="color: #aaa; font-size: 12px;">This is an automated reminder from Dev Lab Platform.</p>
            </div>
          </body>
        </html>
      `,
    });

    this.logger.log(
      `Mentorship reminder sent to ${params.to} (${params.minutesUntil} min before)`,
    );
  }
}
