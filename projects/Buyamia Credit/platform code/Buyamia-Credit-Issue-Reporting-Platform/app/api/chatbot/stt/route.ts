import { NextRequest, NextResponse } from 'next/server'
import OpenAI from 'openai'

const openai = process.env.OPENAI_API_KEY
  ? new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    })
  : null

/**
 * POST /api/chatbot/stt
 * Speech-to-Text using OpenAI Whisper API
 */
export async function POST(request: NextRequest) {
  try {
    // #region agent log
    const logData = { location: 'app/api/chatbot/stt/route.ts:14', message: 'STT API: entry', data: { hasOpenAI: !!openai }, timestamp: Date.now(), sessionId: 'debug-session', runId: 'run1', hypothesisId: 'STT' }
    await fetch('http://127.0.0.1:7242/ingest/7701f9be-b1f8-4b48-943d-5092f29e35b1', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(logData) }).catch(() => {})
    // #endregion

    if (!openai) {
      // #region agent log
      const logData2 = { location: 'app/api/chatbot/stt/route.ts:20', message: 'STT API: OpenAI not configured', data: {}, timestamp: Date.now(), sessionId: 'debug-session', runId: 'run1', hypothesisId: 'STT' }
      await fetch('http://127.0.0.1:7242/ingest/7701f9be-b1f8-4b48-943d-5092f29e35b1', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(logData2) }).catch(() => {})
      // #endregion
      return NextResponse.json(
        { error: 'OpenAI API key not configured' },
        { status: 500 }
      )
    }

    const formData = await request.formData()
    const audioFile = formData.get('audio') as File | Blob | null

    // #region agent log
    const logData3 = { location: 'app/api/chatbot/stt/route.ts:28', message: 'STT API: formData parsed', data: { hasAudioFile: !!audioFile, audioFileType: audioFile?.constructor?.name, audioFileSize: audioFile instanceof Blob ? audioFile.size : 'unknown', hasName: audioFile instanceof File ? !!audioFile.name : false }, timestamp: Date.now(), sessionId: 'debug-session', runId: 'run1', hypothesisId: 'STT' }
    await fetch('http://127.0.0.1:7242/ingest/7701f9be-b1f8-4b48-943d-5092f29e35b1', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(logData3) }).catch(() => {})
    // #endregion

    if (!audioFile) {
      return NextResponse.json(
        { error: 'Audio file is required' },
        { status: 400 }
      )
    }

    // Get language preference (default to English, but can detect or use Indonesian)
    const language = formData.get('language') as string || 'en'

    // Convert to Buffer for OpenAI API (Node.js environment)
    const arrayBuffer = await audioFile.arrayBuffer()
    const buffer = Buffer.from(arrayBuffer)
    
    // #region agent log
    const logData4 = { location: 'app/api/chatbot/stt/route.ts:42', message: 'STT API: buffer created', data: { bufferSize: buffer.length, language }, timestamp: Date.now(), sessionId: 'debug-session', runId: 'run1', hypothesisId: 'STT' }
    await fetch('http://127.0.0.1:7242/ingest/7701f9be-b1f8-4b48-943d-5092f29e35b1', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(logData4) }).catch(() => {})
    // #endregion

    // Create a File-like object for OpenAI
    // OpenAI SDK expects a File, but in Node.js we need to create one from the buffer
    const fileName = audioFile instanceof File && audioFile.name 
      ? audioFile.name 
      : 'recording.webm'
    const fileType = audioFile.type || 'audio/webm'
    
    // Create File from buffer for OpenAI SDK
    const file = new File([buffer], fileName, { type: fileType })

    // #region agent log
    const logData5 = { location: 'app/api/chatbot/stt/route.ts:53', message: 'STT API: calling OpenAI', data: { fileName, fileType, fileSize: file.size }, timestamp: Date.now(), sessionId: 'debug-session', runId: 'run1', hypothesisId: 'STT' }
    await fetch('http://127.0.0.1:7242/ingest/7701f9be-b1f8-4b48-943d-5092f29e35b1', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(logData5) }).catch(() => {})
    // #endregion

    // Call OpenAI Whisper API
    const transcription = await openai.audio.transcriptions.create({
      file: file,
      model: 'whisper-1',
      language: language === 'auto' ? undefined : language, // undefined = auto-detect
      response_format: 'json',
    })

    // #region agent log
    const logData6 = { location: 'app/api/chatbot/stt/route.ts:64', message: 'STT API: OpenAI response received', data: { hasTranscript: !!transcription?.text, transcriptLength: transcription?.text?.length || 0 }, timestamp: Date.now(), sessionId: 'debug-session', runId: 'run1', hypothesisId: 'STT' }
    await fetch('http://127.0.0.1:7242/ingest/7701f9be-b1f8-4b48-943d-5092f29e35b1', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(logData6) }).catch(() => {})
    // #endregion

    const transcript = transcription.text

    if (!transcript || !transcript.trim()) {
      // #region agent log
      const logData7 = { location: 'app/api/chatbot/stt/route.ts:72', message: 'STT API: no transcript found', data: {}, timestamp: Date.now(), sessionId: 'debug-session', runId: 'run1', hypothesisId: 'STT' }
      await fetch('http://127.0.0.1:7242/ingest/7701f9be-b1f8-4b48-943d-5092f29e35b1', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(logData7) }).catch(() => {})
      // #endregion
      return NextResponse.json(
        { error: 'No transcript found in response' },
        { status: 500 }
      )
    }

    // #region agent log
    const logData8 = { location: 'app/api/chatbot/stt/route.ts:80', message: 'STT API: success', data: { transcriptLength: transcript.length }, timestamp: Date.now(), sessionId: 'debug-session', runId: 'run1', hypothesisId: 'STT' }
    await fetch('http://127.0.0.1:7242/ingest/7701f9be-b1f8-4b48-943d-5092f29e35b1', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(logData8) }).catch(() => {})
    // #endregion

    return NextResponse.json({
      transcript: transcript.trim(),
    })
  } catch (error: any) {
    // #region agent log
    const logDataError = { location: 'app/api/chatbot/stt/route.ts:87', message: 'STT API: error caught', data: { errorName: error?.name, errorMessage: error?.message, errorStack: error?.stack?.substring(0, 200) || 'no stack' }, timestamp: Date.now(), sessionId: 'debug-session', runId: 'run1', hypothesisId: 'STT' }
    await fetch('http://127.0.0.1:7242/ingest/7701f9be-b1f8-4b48-943d-5092f29e35b1', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(logDataError) }).catch(() => {})
    // #endregion
    console.error('[API] STT error:', error)
    return NextResponse.json(
      { error: 'Failed to transcribe audio', details: error?.message || 'Unknown error' },
      { status: 500 }
    )
  }
}
