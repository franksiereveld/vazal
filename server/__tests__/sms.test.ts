import { describe, it, expect } from 'vitest';
import { generateSMSCode, sendSMSCode } from '../_core/sms';

describe('SMS Service', () => {
  it('should generate a 6-digit SMS code', () => {
    const code = generateSMSCode();
    expect(code).toHaveLength(6);
    expect(Number(code)).toBeGreaterThanOrEqual(100000);
    expect(Number(code)).toBeLessThanOrEqual(999999);
  });

  it('should have Twilio credentials configured', () => {
    expect(process.env.TWILIO_ACCOUNT_SID).toBeDefined();
    expect(process.env.TWILIO_AUTH_TOKEN).toBeDefined();
    expect(process.env.TWILIO_PHONE_NUMBER).toBeDefined();
    expect(process.env.TWILIO_ACCOUNT_SID).toMatch(/^AC/);
  });

  // Note: We don't actually send SMS in tests to avoid charges
  // Real SMS sending will be tested manually in the browser
});
