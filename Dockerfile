# DMX Lights Controller - Docker Setup
FROM node:20-bookworm-slim

WORKDIR /app

# Copy package files first (better layer caching)
COPY front/package*.json ./

# Install dependencies (skip optional native modules - abletonlink has a bug on Linux)
# See: https://github.com/Ableton/link - requires LINK_PLATFORM_LINUX=1 but npm package doesn't set it
RUN npm install --omit=optional

# Copy the rest of the frontend code
COPY front/ ./

# Expose the dev server port
EXPOSE 3010

# Run dev server (accessible from host)
CMD ["npm", "run", "dev", "--", "--host", "0.0.0.0"]
