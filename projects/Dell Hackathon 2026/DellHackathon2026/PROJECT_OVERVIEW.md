# VOX Co-pilot - Project Overview

## 🎯 Project Purpose

A Non-Invasive AI Co-pilot solution for Singapore Children's Society (SCS) VOX Youth Centre's Digital Drifting operations. This system assists youth workers in identifying at-risk youths through Instagram Stories analysis without automating the process, ensuring compliance with platform policies.

## 🏗️ Architecture

### Three-Component System

1. **Chrome Extension (The Co-pilot)**
   - React-based Manifest V3 extension
   - Injects sidebar on Instagram pages
   - Provides sentiment analysis interface
   - Privacy-focused: processes images in volatile memory

2. **Web Dashboard (CareCenter)**
   - Next.js 14 with App Router
   - Priority Queue for flagged youths
   - Youth Profile views with emotional trends
   - Professional, calming UI (Teal/Soft Blue palette)

3. **Backend API**
   - FastAPI Python server
   - `/analyze` endpoint for sentiment analysis
   - Docker-ready for cloud deployment
   - Currently uses mock analysis (ready for ML integration)

## 🎨 Design Principles

- **Privacy First**: All image processing in volatile memory, no storage
- **Non-Invasive**: Assists manual workflow, doesn't automate
- **HCI Focus**: Calming, professional UI designed for youth workers
- **Compliance**: Adheres to PDPA and Meta platform policies

## 📁 File Structure

```
DellHackathon2026/
├── backend/                 # FastAPI Backend
│   ├── main.py             # API endpoints
│   ├── requirements.txt    # Python dependencies
│   ├── Dockerfile          # Docker configuration
│   └── README.md           # Backend documentation
│
├── dashboard/              # Next.js Dashboard
│   ├── app/
│   │   ├── layout.tsx      # Root layout
│   │   ├── page.tsx        # Priority Queue (main page)
│   │   └── profile/
│   │       └── [id]/
│   │           └── page.tsx # Youth Profile with charts
│   ├── package.json        # Node dependencies
│   └── tailwind.config.js  # Tailwind configuration
│
├── extension/              # Chrome Extension
│   ├── src/
│   │   ├── content.tsx     # Content script (injects sidebar)
│   │   ├── popup.tsx       # Extension popup
│   │   └── components/
│   │       ├── Sidebar.tsx # Main UI component
│   │       └── Sidebar.css # Styling
│   ├── manifest.json       # Extension manifest
│   ├── package.json        # Node dependencies
│   ├── vite.config.ts      # Build configuration
│   └── build-extension.js  # Post-build script
│
├── README.md               # Main project README
├── SETUP.md                # Setup instructions
└── .gitignore             # Git ignore rules
```

## 🚀 Key Features

### Extension Features
- ✅ Sidebar injection on Instagram pages
- ✅ "Check Sentiment" button
- ✅ Risk Score display (High/Medium/Low)
- ✅ Sentiment Tags display
- ✅ Privacy notice in UI
- ✅ Collapsible sidebar

### Dashboard Features
- ✅ Priority Queue sorted by risk level
- ✅ Risk summary cards (High/Medium/Low counts)
- ✅ Filter by risk level
- ✅ Youth Profile pages with:
  - Emotional trends over 30 days
  - 7-day overview charts
  - Overall emotional state trend
  - Average sentiment metrics
- ✅ Professional, calming design

### Backend Features
- ✅ `/analyze` endpoint for sentiment analysis
- ✅ Mock sentiment analysis (realistic patterns)
- ✅ CORS enabled for extension/dashboard
- ✅ Health check endpoint
- ✅ Docker support

## 🔧 Technology Stack

- **Extension**: React 18, TypeScript, Vite, Manifest V3
- **Dashboard**: Next.js 14, React 18, TypeScript, Tailwind CSS, Recharts, Lucide Icons
- **Backend**: FastAPI, Python 3.11+, Pydantic, Uvicorn
- **Deployment**: Docker (backend)

## 📋 Implementation Status

✅ **Completed:**
- Folder structure
- Chrome Extension with manifest.json
- Extension sidebar/overlay UI
- Next.js dashboard with Priority Queue
- Youth Profile page with emotional trends
- FastAPI backend with /analyze endpoint
- Docker configuration
- Privacy-focused UI elements
- Professional HCI design (Teal/Soft Blue)

⏳ **Next Steps:**
- Create extension icons (see `extension/ICONS_README.md`)
- Integrate real ML models for sentiment analysis
- Add database for persistent storage
- Implement authentication
- Deploy to cloud

## 🎯 Hackathon Requirements Met

✅ **SCS Requirements:**
- Non-invasive approach (assists, doesn't automate)
- Privacy-focused (volatile memory processing)
- HCI design (calming, professional UI)
- Risk assessment (High/Medium/Low scoring)

✅ **Dell Requirements:**
- Cloud-native (Docker support)
- Modern tech stack
- Scalable architecture
- Functional prototype

## 📖 Documentation

- `README.md` - Project overview
- `SETUP.md` - Detailed setup instructions
- `backend/README.md` - Backend API documentation
- `extension/README.md` - Extension development guide
- `extension/ICONS_README.md` - Icon creation guide

## 🔐 Privacy & Compliance

- Images processed in volatile memory only
- No persistent storage of user data
- Compliant with PDPA (Singapore)
- Respects Meta platform policies
- Privacy notices in UI

## 🎨 Design System

**Color Palette:**
- Primary: Teal (#0f766e, #0891b2)
- Soft Blue: (#0ea5e9, #0284c7)
- Risk Colors: Red (High), Amber (Medium), Green (Low)

**Typography:**
- System fonts: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto

**UI Principles:**
- Calming, professional aesthetic
- Clear visual hierarchy
- Accessible color contrasts
- Responsive design
