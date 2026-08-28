# VOX Co-pilot Backend API

FastAPI backend for sentiment analysis and risk assessment.

## Development

1. Install dependencies:
```bash
pip install -r requirements.txt
```

2. Run the server:
```bash
uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

3. API Documentation:
   - Swagger UI: http://localhost:8000/docs
   - ReDoc: http://localhost:8000/redoc

## Docker

Build the image:
```bash
docker build -t vox-copilot-backend .
```

Run the container:
```bash
docker run -p 8000:8000 vox-copilot-backend
```

## Endpoints

- `GET /` - API information
- `POST /analyze` - Analyze sentiment from story metadata
- `GET /health` - Health check
