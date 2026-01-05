# Project TODO

## SMS Login Implementation
- [x] Install Twilio SDK
- [x] Add phone number field to user schema
- [x] Create SMS verification table in database
- [x] Implement send OTP endpoint
- [x] Implement verify OTP endpoint
- [x] Build SMS login UI component
- [x] Test SMS login flow
- [x] Add Twilio credentials to environment
- [x] Fix account creation bug
- [x] Test with Swiss phone number

## Docker Deployment
- [x] Create Dockerfile
- [x] Create docker-compose.yml
- [x] Create deployment documentation
- [x] Add .dockerignore

## Completed
- [x] Install Twilio SDK
- [x] Add phone number field to user schema
- [x] Create SMS verification table in database
- [x] Implement send OTP endpoint
- [x] Implement verify OTP endpoint
- [x] Build SMS login UI component

## Dual Database Support
- [ ] Create schema that works with both SQLite and MySQL
- [ ] Update database queries to detect and use correct syntax
- [ ] Test with SQLite on Mac
- [ ] Document MySQL setup for 3090 PC

## Agent Interface Improvements
- [x] Fix white-on-white text in user message bubbles
- [x] Fix logout error
- [x] Add name field to SMS login form
- [x] Fix Vazal asyncio event loop conflict when running from Node.js
- [x] Filter debug logs from Vazal output, only show final answer
- [ ] Implement interactive mode with persistent Python process for follow-up questions
- [ ] Add download button for agent results/files
