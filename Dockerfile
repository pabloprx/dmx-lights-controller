# DMX Lights Controller - Docker Setup
FROM node:23-bookworm-slim

# Install build dependencies for native modules (abletonlink)
RUN apt-get update && apt-get install -y \
    python3 \
    make \
    g++ \
    libasound2-dev \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy package files first (better layer caching)
COPY front/package*.json ./

# Install dependencies
RUN npm install

# Copy the rest of the frontend code
COPY front/ ./

# Expose the dev server port
EXPOSE 3010

# Run dev server (accessible from host)
CMD ["npm", "run", "dev", "--", "--host", "0.0.0.0"]
