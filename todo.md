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
- [x] Create Python wrapper script to isolate Vazal event loop
- [x] Filter debug logs from Vazal output, only show final answer
- [ ] Implement interactive mode with persistent Python process for follow-up questions
- [ ] Add download button for agent results/files

## Performance Optimizations
- [x] Use Vazal's built-in LLM-based chat vs task detection (removed duplicate logic)
- [ ] Implement persistent Vazal process manager (keep Python warm)
- [ ] Pre-warm browser and database tools on startup


## Conversation Management (Jan 10, 2026)
- [ ] Fix conversation sidebar display
- [ ] Implement chat history persistence to database
- [ ] Add delete conversation functionality
- [ ] Show conversation list with titles/timestamps

## File Upload/Download
- [ ] Add file upload button to chat input
- [ ] Create file upload API endpoint
- [ ] Store uploaded files (local or S3)
- [ ] Pass uploaded file paths to Vazal
- [ ] Extract output file paths from Vazal response
- [ ] Add download buttons for output files (PPTX, DOCX, etc.)
- [ ] Serve files via download endpoint

## Learning System
- [ ] User-specific memories (preferences, context, history)
- [ ] Generic lessons (patterns learned across all users)
- [ ] Integrate with Vazal's memory system
- [ ] Store learnings in database
- [ ] Allow users to view/manage their memories

## Login Flow Improvements
- [ ] Fix "change phone number" button
- [ ] Ask for name AFTER signup (not during)
- [ ] Show user name in header (allow editing)
