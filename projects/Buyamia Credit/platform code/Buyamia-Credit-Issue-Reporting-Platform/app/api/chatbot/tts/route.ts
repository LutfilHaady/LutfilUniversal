import { NextRequest, NextResponse } from 'next/server'
import OpenAI from 'openai'

const openai = process.env.OPENAI_API_KEY
  ? new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    })
  : null

export async function POST(request: NextRequest) {
  try {
    if (!openai) {
      return NextResponse.json(
        { error: 'OpenAI not configured' },
        { status: 500 }
      )
    }

    const { text } = await request.json()

    if (!text || typeof text !== 'string') {
      return NextResponse.json(
        { error: 'Text is required' },
        { status: 400 }
      )
    }

    // Remove markdown formatting for cleaner speech (*word* -> word)
    const cleanText = text.replace(/\*([^*]+)\*/g, '$1')

    // Call OpenAI TTS API with nova voice - optimized for speed
    const mp3 = await openai.audio.speech.create({
      model: 'tts-1', // Use tts-1 for faster response (not tts-1-hd)
      voice: 'nova', // Bright, energetic voice
      input: cleanText,
      response_format: 'mp3', // Explicitly set format for faster processing
    })

    // Stream the response directly to client for faster delivery
    // Convert response to buffer immediately
    const arrayBuffer = await mp3.arrayBuffer()
    const buffer = Buffer.from(arrayBuffer)

    // Return audio file with optimized headers
    return new NextResponse(buffer, {
      headers: {
        'Content-Type': 'audio/mpeg',
        'Content-Length': buffer.length.toString(),
        'Cache-Control': 'no-cache', // Don't cache for real-time responses
      },
    })
  } catch (error) {
    console.error('[API] TTS error:', error)
    return NextResponse.json(
      { error: 'Failed to generate speech' },
      { status: 500 }
    )
  }
}

