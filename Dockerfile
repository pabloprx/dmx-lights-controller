# DMX Lights Controller - Docker Setup
FROM node:20-bookworm-slim

WORKDIR /app

# Copy package files first (better layer caching)
COPY front/package*.json ./

# Install dependencies
# abletonlink is in optionalDependencies - it will fail to build on Linux but npm should continue
RUN npm install

# Copy the rest of the frontend code
COPY front/ ./

# Expose the dev server port
EXPOSE 3010

# Run dev server (accessible from host)
CMD ["npm", "run", "dev", "--", "--host", "0.0.0.0"]
