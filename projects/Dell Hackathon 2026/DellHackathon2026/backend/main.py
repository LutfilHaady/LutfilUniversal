from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List, Literal
import random
from datetime import datetime

app = FastAPI(title="VOX Co-pilot API", version="1.0.0")

# CORS middleware to allow requests from extension and dashboard
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # In production, specify exact origins
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


class AnalyzeRequest(BaseModel):
    url: str
    timestamp: str
    # In production, this might include image data or metadata


class SentimentTag(BaseModel):
    tag: str
    confidence: float


class AnalyzeResponse(BaseModel):
    riskScore: Literal["High", "Medium", "Low"]
    sentimentTags: List[str]
    confidence: float
    analyzedAt: str


@app.get("/")
async def root():
    return {
        "message": "VOX Co-pilot API",
        "version": "1.0.0",
        "endpoints": {
            "analyze": "/analyze - POST - Analyze sentiment from story metadata"
        }
    }


@app.post("/analyze", response_model=AnalyzeResponse)
async def analyze_sentiment(request: AnalyzeRequest):
    """
    Analyze sentiment from Instagram story metadata.
    In production, this would use actual ML models for sentiment analysis.
    For now, returns mock data with realistic patterns.
    """
    try:
        # Mock sentiment analysis logic
        # In production, this would:
        # 1. Process image in volatile memory (not stored)
        # 2. Run ML model for sentiment analysis
        # 3. Calculate risk score based on sentiment patterns
        
        # Simulate analysis with weighted randomness
        rand = random.random()
        
        if rand < 0.3:  # 30% chance of high risk
            risk_score = "High"
            possible_tags = [
                ["Anxiety", "Sadness", "Isolation"],
                ["Anger", "Frustration"],
                ["Depression", "Hopelessness"],
            ]
            sentiment_tags = random.choice(possible_tags)
            confidence = random.uniform(0.75, 0.95)
        elif rand < 0.6:  # 30% chance of medium risk
            risk_score = "Medium"
            possible_tags = [
                ["Anxiety"],
                ["Sadness"],
                ["Stress"],
            ]
            sentiment_tags = random.choice(possible_tags)
            confidence = random.uniform(0.60, 0.80)
        else:  # 40% chance of low risk
            risk_score = "Low"
            sentiment_tags = []
            confidence = random.uniform(0.50, 0.70)
        
        return AnalyzeResponse(
            riskScore=risk_score,
            sentimentTags=sentiment_tags,
            confidence=confidence,
            analyzedAt=datetime.utcnow().isoformat(),
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Analysis failed: {str(e)}")


@app.get("/health")
async def health_check():
    return {"status": "healthy", "timestamp": datetime.utcnow().isoformat()}
