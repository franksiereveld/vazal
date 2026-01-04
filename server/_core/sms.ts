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
      console.error('[SMS] TWILIO_PHONE_NUMBER not configured');
      throw new Error('TWILIO_PHONE_NUMBER not configured');
    }
    
    console.log('[SMS] Attempting to send SMS');
    console.log('[SMS] From:', fromNumber);
    console.log('[SMS] To:', phone);
    console.log('[SMS] Code:', code);
    
    const message = await client.messages.create({
      body: `Your vazal.ai verification code is: ${code}`,
      from: fromNumber,
      to: phone,
    });
    
    console.log('[SMS] Message sent successfully. SID:', message.sid);
    return true;
  } catch (error: any) {
    console.error('[SMS] Failed to send code');
    console.error('[SMS] Error code:', error.code);
    console.error('[SMS] Error message:', error.message);
    console.error('[SMS] More info:', error.moreInfo);
    console.error('[SMS] Full error:', error);
    return false;
  }
}

export function generateSMSCode(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}
