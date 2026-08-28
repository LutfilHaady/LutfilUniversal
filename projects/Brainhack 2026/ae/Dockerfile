# Dockerfile for building the AE image.

# The base image. Using a regular Python base because AE agents don't typically
# require GPU. This will speed up your evaluation.
FROM python:3.11-slim

# Configures settings for the image.
ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1
ENV PIP_ROOT_USER_ACTION=ignore
# Novice fixed-map pre-seed (seed 88 walls + bases). Set 0 if eval layout is not novice.
# Override at build: docker build --build-arg TIL_PRESEED_MAP=0 ...
ARG TIL_PRESEED_MAP=1
ENV TIL_PRESEED_MAP=${TIL_PRESEED_MAP}
WORKDIR /workspace

# pip git+https:// for til_environment needs git in the image.
RUN apt-get update \
    && apt-get install -y --no-install-recommends git \
    && rm -rf /var/lib/apt/lists/*

# Installs your dependencies.
RUN pip install -U pip
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copies your source files (code + any extra files under src/).
COPY src .

# Starts your model server.
CMD uvicorn ae_server:app --port 5005 --host 0.0.0.0
