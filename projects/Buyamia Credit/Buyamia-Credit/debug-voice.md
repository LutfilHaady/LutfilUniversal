# Voice Prompt Debugging Guide

## Common Issues & Solutions

### 1. Environment Variables Missing
Check your `.env.local` file contains:
```
DEEPGRAM_API_KEY=your_deepgram_api_key_here
```

To get a Deepgram API key:
1. Go to https://deepgram.com/
2. Sign up for free account
3. Get API key from dashboard
4. Add to your environment variables

### 2. Browser Permissions
- Ensure microphone permissions are granted
- Check browser console for permission errors
- Try in Chrome/Firefox (works best)

### 3. Audio Recording Issues
The updated code now includes:
- Better MIME type detection
- Auto-gain control
- Recording timeout (30 seconds)
- Detailed console logging

### 4. Testing Steps
1. Open browser console (F12)
2. Click voice button in chatbot
3. Look for these console messages:
   - "Recording started..."
   - "MediaRecorder stopped, processing audio..."
   - "Audio blob created: X bytes"
   - "Sending audio to STT API..."
   - "Transcript received: [text]"

### 5. Common Error Messages
- **"Microphone permission denied"**: Grant mic access in browser
- **"No speech detected"**: Speak clearly and closer to mic
- **"Deepgram API key not configured"**: Add DEEPGRAM_API_KEY to .env
- **"Failed to transcribe audio"**: Check network connection and API key

### 6. Manual Testing
Test the STT API directly:
```bash
curl -X POST http://localhost:3000/api/chatbot/stt \
  -H "Content-Type: multipart/form-data" \
  -F "audio=@test-audio.webm" \
  -F "language=en"
```

### 7. Browser Compatibility
- Chrome: Full support
- Firefox: Good support
- Safari: May have issues
- Mobile browsers: Limited support

## Quick Fix Checklist
- [ ] Deepgram API key in .env
- [ ] Microphone permissions granted
- [ ] Browser console open for debugging
- [ ] Test in Chrome/Firefox
- [ ] Check network connectivity
- [ ] Restart development server after .env changes
