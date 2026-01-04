import twilio from 'twilio';

const accountSid = process.env.TWILIO_ACCOUNT_SID;
const authToken = process.env.TWILIO_AUTH_TOKEN;
const fromNumber = process.env.TWILIO_PHONE_NUMBER;
const toNumber = '+14083753417';

console.log('=== Twilio SMS Test ===');
console.log('From:', fromNumber);
console.log('To:', toNumber);
console.log('');

try {
  const client = twilio(accountSid, authToken);
  
  const message = await client.messages.create({
    body: 'Test from vazal.ai - Your verification code is: 123456',
    from: fromNumber,
    to: toNumber,
  });
  
  console.log('✅ SUCCESS!');
  console.log('Message SID:', message.sid);
  console.log('Status:', message.status);
} catch (error) {
  console.log('❌ FAILED!');
  console.log('Error Code:', error.code);
  console.log('Error Message:', error.message);
  console.log('More Info:', error.moreInfo);
}
