# Chatbot Implementation

## Overview

A simple, text-only AI chatbot widget that:
- Appears in the bottom-right corner of the page
- Only accessible after user login
- Queries Supabase database for user data
- Uses OpenAI GPT-4o-mini to generate natural language responses

## Components

### 1. `components/ChatbotWidget.tsx`
- Fixed position widget in bottom-right corner
- Minimizable and closable
- Text-only chat interface
- Sends messages to `/api/chatbot` endpoint

### 2. `components/AuthenticatedAIAssistant.tsx`
- Wrapper component that checks authentication
- Only renders `ChatbotWidget` if user is authenticated
- Checks auth status on mount and periodically

### 3. `app/api/chatbot/route.ts`
- POST endpoint that handles chatbot messages
- Authenticates user via session cookie
- Queries Prisma/Supabase for user data (invoices, issues, credit score)
- Sends context to OpenAI GPT-4o-mini
- Returns natural language response

## Setup

1. Ensure `OPENAI_API_KEY` is set in `.env.local`
2. Ensure database connection is configured (Prisma)
3. The widget will automatically appear for authenticated users

## Usage

1. User logs in
2. Chatbot button appears in bottom-right corner
3. User clicks button to open chat
4. User asks questions about their data
5. AI responds with natural language summaries

## Features

- ✅ Text-only (no voice)
- ✅ Bottom-right fixed position
- ✅ Only visible after login
- ✅ Queries Supabase/Prisma database
- ✅ Natural language responses
- ✅ Conversation history support
- ✅ Minimizable and closable

## Old LiveKit Agent

The old LiveKit agent code has been archived to `livekit-agent/agent.py.old`. The new implementation is simpler and doesn't require LiveKit infrastructure.



