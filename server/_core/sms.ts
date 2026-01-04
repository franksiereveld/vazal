import twilio from 'twilio';
import { ENV } from './env';

let twilioClient: ReturnType<typeof twilio> | null = null;

function getTwilioClient() {
  if (!twilioClient) {
    const accountSid = process.env.TWILIO_ACCOUNT_SID;
    const authToken = process.env.TWILIO_AUTH_TOKEN;
    
    if (!accountSid || !authToken) {
      throw new Error('Twilio credentials not configured');
    }
    
    twilioClient = twilio(accountSid, authToken);
  }
  
  return twilioClient;
}

export async function sendSMSCode(phone: string, code: string): Promise<boolean> {
  try {
    const client = getTwilioClient();
    const fromNumber = process.env.TWILIO_PHONE_NUMBER;
    
    if (!fromNumber) {
      throw new Error('TWILIO_PHONE_NUMBER not configured');
    }
    
    await client.messages.create({
      body: `Your vazal.ai verification code is: ${code}`,
      from: fromNumber,
      to: phone,
    });
    
    return true;
  } catch (error) {
    console.error('[SMS] Failed to send code:', error);
    return false;
  }
}

export function generateSMSCode(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}
