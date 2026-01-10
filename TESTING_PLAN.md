# Vazal Testing Plan

## Overview
This document outlines the testing plan for the Vazal web application features.

## Pre-requisites
1. Ubuntu PC with MySQL running
2. Website running via `pnpm dev`
3. Access from Mac browser via `http://vazal:3000`

## Test Cases

### 1. Authentication
- [ ] **Login Flow**: Enter phone number → Receive SMS → Enter code → Redirect to /agent
- [ ] **Logout**: Click logout → Redirect to login page
- [ ] **Session Persistence**: Refresh page → Stay logged in

### 2. Chat vs Task Classification
- [ ] **Chat Detection**: Type "Hi" or "Hello" → Immediate friendly response (no execution plan)
- [ ] **Task Detection**: Type "Create a presentation about AI" → Shows execution plan
- [ ] **Quick Mode**: Toggle Quick mode ON → Tasks execute without plan confirmation

### 3. Conversation Sidebar
- [ ] **New Chat**: Click "+ New Chat" → Clears messages, starts fresh
- [ ] **Select Conversation**: Click existing conversation → Loads messages
- [ ] **Delete Conversation**: Click trash icon → Conversation removed from list
- [ ] **Collapse/Expand**: Click collapse button → Sidebar toggles

### 4. File Upload
- [ ] **Upload Button**: Click paperclip icon → File picker opens
- [ ] **File Preview**: Select file → Shows in preview area below input
- [ ] **Remove File**: Click X on file chip → File removed from queue
- [ ] **Multiple Files**: Upload multiple files → All shown in preview
- [ ] **Send with Files**: Type message + attach file → Both sent to Vazal

### 5. File Download
- [ ] **Output Files**: Ask Vazal to create a file → Download button appears in response
- [ ] **Download Click**: Click download button → File downloads to browser

### 6. Persistent Process (Performance)
- [ ] **Cold Start**: First message after server restart → May take 5-10s
- [ ] **Warm Response**: Second message → Should be <2s for classification
- [ ] **Session Persistence**: Multiple messages → Same Vazal session used

### 7. LaTeX Rendering
- [ ] **Math Display**: Ask "What is the quadratic formula?" → Shows formatted equation
- [ ] **Inline Math**: Response with $x^2$ → Renders inline

### 8. Error Handling
- [ ] **Network Error**: Disconnect network → Shows error toast
- [ ] **Invalid Input**: Send empty message → Button disabled
- [ ] **Server Error**: If Vazal fails → Shows error message in chat

## Manual Testing Steps

### Quick Smoke Test
1. Open `http://vazal:3000` from Mac
2. Login with phone number
3. Type "Hi" → Should get friendly response immediately
4. Type "What is 2+2?" → Should answer without execution plan
5. Type "Create a simple Python script" → Should show execution plan
6. Click Execute → Should run and show result
7. Click "+ New Chat" → Should clear
8. Check sidebar shows conversation history

### File Upload Test
1. Click paperclip icon
2. Select a PDF or image file
3. Type "Summarize this document"
4. Click send
5. Verify file is processed

### Performance Test
1. Restart server (`pnpm dev`)
2. Send first message, note time
3. Send second message, note time
4. Second should be significantly faster

## Known Issues
- First request after server start is slow (cold start)
- Large files may take time to upload

## Success Criteria
- All test cases pass
- No console errors
- Responsive UI
- Fast subsequent responses (<2s for chat)
