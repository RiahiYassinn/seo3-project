import { Injectable, Logger } from '@nestjs/common';
import * as nodemailer from 'nodemailer';

@Injectable()
export class EmailService {
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

  async sendVerificationEmail(to: string, name: string, token: string): Promise<void> {
    const verifyUrl = `${process.env.FRONTEND_VERIFY_EMAIL_URL || 'http://localhost:3000/verify-email'}?token=${token}`;
    const from = process.env.EMAIL_FROM || process.env.SMTP_USER;

    await this.transporter.sendMail({
      from: `"SEO3 Platform" <${from}>`,
      to,
      subject: 'Verify your email address',
      html: `
        <!DOCTYPE html>
        <html>
          <body style="font-family: Arial, sans-serif; background: #f4f4f4; padding: 20px;">
            <div style="max-width: 560px; margin: 0 auto; background: #fff; border-radius: 8px; padding: 32px; box-shadow: 0 2px 8px rgba(0,0,0,0.1);">
              <h2 style="color: #1a1a1a; margin-top: 0;">Verify your email</h2>
              <p style="color: #444;">Hi ${name},</p>
              <p style="color: #444;">Thanks for signing up for SEO3 Platform. Click the button below to verify your email address. This link expires in 24 hours.</p>
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
      from: `"SEO3 Platform" <${from}>`,
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
      from: `"SEO3 Platform" <${from}>`,
      to,
      subject: 'Your account credentials',
      html: `
      <!DOCTYPE html>
      <html>
        <body style="font-family: Arial, sans-serif; background: #f4f4f4; padding: 20px;">
          <div style="max-width: 560px; margin: 0 auto; background: #fff; border-radius: 8px; padding: 32px; box-shadow: 0 2px 8px rgba(0,0,0,0.1);">
            <h2 style="color: #1a1a1a; margin-top: 0;">Welcome to SEO3 Platform 🎉</h2>
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
}
