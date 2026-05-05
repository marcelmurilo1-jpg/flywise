import { Resend } from 'resend';

export const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null;
export const RESEND_FROM = process.env.RESEND_FROM ?? 'FlyWise <alertas@flywise.app>';
