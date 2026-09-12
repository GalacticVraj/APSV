import nodemailer from 'nodemailer';
import { logger } from '../utils/logger';

interface EmailOptions {
  to: string;
  subject: string;
  html: string;
  text?: string;
}

let transporter: nodemailer.Transporter | null = null;

function getTransporter(): nodemailer.Transporter | null {
  if (!process.env.SMTP_USER || !process.env.SMTP_PASS) {
    return null;
  }
  if (!transporter) {
    transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST || 'smtp.gmail.com',
      port: parseInt(process.env.SMTP_PORT || '587', 10),
      secure: process.env.SMTP_SECURE === 'true',
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    });
  }
  return transporter;
}

export async function sendEmail(options: EmailOptions): Promise<boolean> {
  const t = getTransporter();
  if (!t) {
    logger.warn('Email not configured, skipping send', { to: options.to, subject: options.subject });
    return false;
  }
  try {
    await t.sendMail({
      from: process.env.EMAIL_FROM || 'CarbonLoop <noreply@carbonloop.in>',
      to: options.to,
      subject: options.subject,
      html: options.html,
      text: options.text || options.html.replace(/<[^>]*>/g, ''),
    });
    logger.info('Email sent', { to: options.to, subject: options.subject });
    return true;
  } catch (err) {
    logger.error('Email send failed', { error: (err as Error).message, to: options.to });
    return false;
  }
}

export function matchNotificationEmail(params: {
  recipientName: string;
  facilityName: string;
  wasteType: string;
  score: number;
}): string {
  return `
    <div style="font-family: 'Helvetica Neue', sans-serif; max-width: 600px; margin: 0 auto; background: #f9fafb; padding: 24px; border-radius: 8px;">
      <div style="background: #166534; padding: 20px; border-radius: 6px 6px 0 0; text-align: center;">
        <h1 style="color: #fff; margin: 0; font-size: 22px;">CarbonLoop</h1>
        <p style="color: #bbf7d0; margin: 4px 0 0;">New Match Found</p>
      </div>
      <div style="background: #fff; padding: 24px; border-radius: 0 0 6px 6px; border: 1px solid #e5e7eb; border-top: none;">
        <p style="color: #111827; font-size: 16px;">Hi ${params.recipientName},</p>
        <p style="color: #374151;">A new facility match has been found for your waste listing.</p>
        <div style="background: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 6px; padding: 16px; margin: 16px 0;">
          <p style="margin: 0; color: #166534; font-weight: 600;">Facility: ${params.facilityName}</p>
          <p style="margin: 8px 0 0; color: #374151;">Waste Type: ${params.wasteType}</p>
          <p style="margin: 4px 0 0; color: #374151;">Match Score: ${params.score}/100</p>
        </div>
        <p style="color: #374151;">Log in to your CarbonLoop dashboard to view details and respond.</p>
        <a href="${process.env.CORS_ORIGIN || 'http://localhost:5173'}/dashboard" 
           style="display: inline-block; background: #166534; color: #fff; padding: 12px 24px; border-radius: 6px; text-decoration: none; font-weight: 600; margin-top: 8px;">
          View Match
        </a>
      </div>
      <p style="color: #9ca3af; font-size: 12px; text-align: center; margin-top: 16px;">
        CarbonLoop. Building a circular carbon economy.
      </p>
    </div>
  `;
}

export function pickupStatusEmail(params: {
  recipientName: string;
  pickupId: string;
  newStatus: string;
  timestamp: string;
}): string {
  const statusLabels: Record<string, string> = {
    scheduled: 'Scheduled',
    in_transit: 'In Transit',
    delivered: 'Delivered',
    verified: 'Verified',
    cancelled: 'Cancelled',
  };
  return `
    <div style="font-family: 'Helvetica Neue', sans-serif; max-width: 600px; margin: 0 auto; background: #f9fafb; padding: 24px; border-radius: 8px;">
      <div style="background: #166534; padding: 20px; border-radius: 6px 6px 0 0; text-align: center;">
        <h1 style="color: #fff; margin: 0; font-size: 22px;">CarbonLoop</h1>
        <p style="color: #bbf7d0; margin: 4px 0 0;">Pickup Status Update</p>
      </div>
      <div style="background: #fff; padding: 24px; border-radius: 0 0 6px 6px; border: 1px solid #e5e7eb; border-top: none;">
        <p style="color: #111827; font-size: 16px;">Hi ${params.recipientName},</p>
        <p style="color: #374151;">Your pickup status has been updated.</p>
        <div style="background: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 6px; padding: 16px; margin: 16px 0;">
          <p style="margin: 0; color: #166534; font-weight: 600;">Status: ${statusLabels[params.newStatus] || params.newStatus}</p>
          <p style="margin: 8px 0 0; color: #374151;">Updated: ${params.timestamp}</p>
        </div>
        <a href="${process.env.CORS_ORIGIN || 'http://localhost:5173'}/pickups/${params.pickupId}" 
           style="display: inline-block; background: #166534; color: #fff; padding: 12px 24px; border-radius: 6px; text-decoration: none; font-weight: 600; margin-top: 8px;">
          Track Pickup
        </a>
      </div>
    </div>
  `;
}
