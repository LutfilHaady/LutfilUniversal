# Setup Guide - VOX Co-pilot

This guide will help you set up and run all three components of the VOX Co-pilot system.

## Prerequisites

- **Node.js** 18+ and npm
- **Python** 3.11+
- **Chrome Browser** (for testing the extension)
- **Docker** (optional, for backend deployment)

## Quick Start

### 1. Backend API (FastAPI)

```bash
cd backend
pip install -r requirements.txt
uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

The API will be available at:
- API: http://localhost:8000
- Swagger Docs: http://localhost:8000/docs
- Health Check: http://localhost:8000/health

**Using Docker:**
```bash
cd backend
docker build -t vox-copilot-backend .
docker run -p 8000:8000 vox-copilot-backend
```

### 2. Dashboard (Next.js)

```bash
cd dashboard
npm install
npm run dev
```

The dashboard will be available at: http://localhost:3000

### 3. Chrome Extension

```bash
cd extension
npm install
npm run build
```

**Loading the Extension in Chrome:**
1. Open Chrome and navigate to `chrome://extensions/`
2. Enable "Developer mode" (toggle in top-right)
3. Click "Load unpacked"
4. Select the `extension/dist` folder

**Note:** You'll need to create icon files (see `extension/ICONS_README.md`) before the extension will load properly. For quick testing, you can create simple placeholder PNG files.

## Testing the System

1. **Start the backend** (port 8000)
2. **Start the dashboard** (port 3000)
3. **Load the extension** in Chrome
4. **Navigate to Instagram** (https://www.instagram.com)
5. You should see the VOX Co-pilot sidebar on the right side
6. Click "Check Sentiment" to test the analysis (requires backend to be running)
7. View flagged youths in the dashboard at http://localhost:3000

## Project Structure

```
.
├── backend/           # FastAPI backend
│   ├── main.py       # API endpoints
│   ├── Dockerfile    # Docker configuration
│   └── requirements.txt
│
├── dashboard/        # Next.js dashboard
│   ├── app/
│   │   ├── page.tsx              # Priority Queue
│   │   └── profile/[id]/page.tsx  # Youth Profile
│   └── package.json
│
└── extension/        # Chrome Extension
    ├── src/
    │   ├── content.tsx      # Content script
    │   └── components/
    │       └── Sidebar.tsx  # Main UI component
    └── manifest.json
```

## Troubleshooting

### Extension not appearing on Instagram
- Make sure you're on `https://www.instagram.com/*`
- Check browser console for errors (F12)
- Verify the extension is enabled in `chrome://extensions/`

### Backend connection errors
- Ensure the backend is running on port 8000
- Check CORS settings in `backend/main.py`
- Verify the extension's `host_permissions` in `manifest.json`

### Dashboard not loading
- Ensure Next.js dev server is running
- Check for port conflicts (default: 3000)
- Verify all dependencies are installed (`npm install`)

## Development Notes

- The extension uses React with Vite for building
- The dashboard uses Next.js 14 with App Router
- The backend uses FastAPI with mock sentiment analysis (ready for ML integration)
- All components are designed to be privacy-focused and compliant with PDPA/Meta policies

## Next Steps

1. Create proper extension icons (see `extension/ICONS_README.md`)
2. Integrate real ML models for sentiment analysis
3. Add database for storing youth profiles
4. Implement authentication for the dashboard
5. Deploy to cloud (backend is Docker-ready)
