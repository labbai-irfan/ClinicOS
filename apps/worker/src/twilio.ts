import twilio from 'twilio';
import { logger } from './logger';

const ACCOUNT_SID = process.env.TWILIO_ACCOUNT_SID;
const AUTH_TOKEN = process.env.TWILIO_AUTH_TOKEN;
const SMS_FROM = process.env.TWILIO_SMS_FROM;
const WHATSAPP_FROM = process.env.TWILIO_WHATSAPP_FROM;

let client: ReturnType<typeof twilio> | null = null;

function getClient(): ReturnType<typeof twilio> | null {
  if (client) return client;
  if (!ACCOUNT_SID || !AUTH_TOKEN) return null;
  client = twilio(ACCOUNT_SID, AUTH_TOKEN);
  return client;
}

export function isTwilioConfigured(): boolean {
  return Boolean(ACCOUNT_SID && AUTH_TOKEN);
}

export interface SendResult {
  sent: boolean;
  providerMessageId?: string;
  error?: string;
}

export async function sendSms(to: string, body: string): Promise<SendResult> {
  const c = getClient();
  if (!c || !SMS_FROM) {
    logger.warn('Twilio SMS not configured (TWILIO_ACCOUNT_SID/AUTH_TOKEN/SMS_FROM) — skipping send.');
    return { sent: false, error: 'Twilio SMS not configured' };
  }
  try {
    const msg = await c.messages.create({ to, from: SMS_FROM, body });
    return { sent: true, providerMessageId: msg.sid };
  } catch (err) {
    const error = err instanceof Error ? err.message : 'Unknown Twilio error';
    logger.error({ err }, 'Twilio SMS send failed');
    return { sent: false, error };
  }
}

export async function sendWhatsApp(to: string, body: string): Promise<SendResult> {
  const c = getClient();
  if (!c || !WHATSAPP_FROM) {
    logger.warn('Twilio WhatsApp not configured (TWILIO_ACCOUNT_SID/AUTH_TOKEN/WHATSAPP_FROM) — skipping send.');
    return { sent: false, error: 'Twilio WhatsApp not configured' };
  }
  try {
    const from = WHATSAPP_FROM.startsWith('whatsapp:') ? WHATSAPP_FROM : `whatsapp:${WHATSAPP_FROM}`;
    const dest = to.startsWith('whatsapp:') ? to : `whatsapp:${to}`;
    const msg = await c.messages.create({ to: dest, from, body });
    return { sent: true, providerMessageId: msg.sid };
  } catch (err) {
    const error = err instanceof Error ? err.message : 'Unknown Twilio error';
    logger.error({ err }, 'Twilio WhatsApp send failed');
    return { sent: false, error };
  }
}
