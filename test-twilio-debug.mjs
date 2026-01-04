import twilio from 'twilio';

const accountSid = process.env.TWILIO_ACCOUNT_SID;
const authToken = process.env.TWILIO_AUTH_TOKEN;
const fromNumber = process.env.TWILIO_PHONE_NUMBER;

console.log('Testing Twilio...');
console.log('Account SID:', accountSid ? `${accountSid.substring(0, 10)}...` : 'NOT SET');
console.log('Auth Token:', authToken ? 'SET (hidden)' : 'NOT SET');
console.log('From Number:', fromNumber);

if (!accountSid || !authToken || !fromNumber) {
  console.error('Missing credentials!');
  process.exit(1);
}

try {
  const client = twilio(accountSid, authToken);
  
  console.log('\nSending test SMS to:', fromNumber);
  
  const message = await client.messages.create({
    body: 'Test from vazal.ai - Your code is: 123456',
    from: fromNumber,
    to: fromNumber,
  });
  
  console.log('✅ SMS sent successfully!');
  console.log('Message SID:', message.sid);
  console.log('Status:', message.status);
} catch (error) {
  console.error('❌ Error sending SMS:');
  console.error('Code:', error.code);
  console.error('Message:', error.message);
  if (error.moreInfo) console.error('More info:', error.moreInfo);
  console.error('Full error:', error);
}
