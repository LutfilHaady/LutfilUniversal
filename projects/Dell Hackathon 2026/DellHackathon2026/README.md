# VOX Co-pilot - Dell InnovateDash Hackathon 2026

A Non-Invasive AI Co-pilot solution for Singapore Children's Society (SCS) VOX Youth Centre's Digital Drifting operations.

## Project Overview

Youth workers at VOX perform "Digital Drifting" to identify youths in distress via Instagram Stories. This solution provides an AI Co-pilot that assists the manual workflow without automating it, ensuring compliance with platform policies and privacy regulations.

## Architecture

### 1. Chrome Extension (The Co-pilot)
- **Location**: `/extension`
- **Tech Stack**: React + Vite + TypeScript
- **Features**:
  - Injects sidebar on Instagram pages
  - "Check Sentiment" button for story analysis
  - Displays Risk Score and Sentiment Tags
  - Privacy-focused: processes images in volatile memory only

### 2. Web Dashboard (CareCenter)
- **Location**: `/dashboard`
- **Tech Stack**: Next.js 14 (App Router) + Tailwind CSS
- **Features**:
  - Priority Queue of flagged youths
  - Youth Profile views with Emotional Trends
  - Risk-based sorting and filtering

### 3. Backend API
- **Location**: `/backend`
- **Tech Stack**: FastAPI + Python
- **Features**:
  - `/analyze` endpoint for sentiment analysis
  - Mock sentiment analysis (ready for ML integration)
  - Docker support for cloud deployment

## Getting Started

### Prerequisites
- Node.js 18+
- Python 3.11+
- Docker (optional)

### Setup

#### Backend
```bash
cd backend
pip install -r requirements.txt
uvicorn main:app --reload
```

#### Dashboard
```bash
cd dashboard
npm install
npm run dev
```

#### Extension
```bash
cd extension
npm install
npm run build
# Load dist/ folder in Chrome as unpacked extension
```

## Design Principles

- **Privacy First**: All image processing in volatile memory, no storage
- **Non-Invasive**: Assists manual workflow, doesn't automate
- **HCI Focus**: Calming, professional UI (Teal/Soft Blue palette)
- **Compliance**: Adheres to PDPA and Meta platform policies

## Project Structure

```
.
├── extension/          # Chrome Extension (React + Vite)
├── dashboard/          # Next.js Dashboard
├── backend/            # FastAPI Backend
└── README.md
```

## License

This project is developed for the Dell InnovateDash Hackathon 2026.
