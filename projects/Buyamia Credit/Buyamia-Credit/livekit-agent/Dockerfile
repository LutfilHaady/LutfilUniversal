# Dockerfile for Python LiveKit Agent
FROM python:3.11-slim

WORKDIR /app

# Install system dependencies
RUN apt-get update && apt-get install -y \
    gcc \
    && rm -rf /var/lib/apt/lists/*

# Copy requirements and install Python dependencies
COPY livekit-agent/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy agent code from project root
COPY livekit-agent/ .

# Set Python path
ENV PYTHONUNBUFFERED=1

# Run the agent
CMD ["python", "agent.py", "start"]
