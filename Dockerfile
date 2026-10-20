# Multi-stage production Dockerfile for GodHand Studio
# Supports Render (*.onrender.com), Koyeb (*.koyeb.app), and Hugging Face Spaces (*.hf.space)

FROM eclipse-temurin:21-jdk-jammy AS base

# Install Node.js 22, git, curl
RUN apt-get update && apt-get install -y --no-install-recommends \
    curl \
    git \
    ca-certificates \
    build-essential \
    && curl -fsSL https://deb.nodesource.com/setup_22.x | bash - \
    && apt-get install -y --no-install-recommends nodejs \
    && apt-get clean \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy root and dashboard package manifests
COPY package*.json ./
COPY dashboard/package*.json ./dashboard/

# Install dependencies
RUN npm install
RUN npm install --prefix dashboard

# Copy entire application
COPY . .

# Ensure Gradle wrapper is executable
RUN chmod +x godhand/gradlew || true

# Build dashboard frontend bundle
RUN npm run build --prefix dashboard

ENV NODE_ENV=production
ENV PORT=3000

EXPOSE 3000 10000 8000

CMD ["node", "dashboard/server.js"]
