# DMX Lights Controller - Docker Setup
FROM node:20-bookworm-slim

WORKDIR /app

# Copy only package.json (not lock file - avoids platform-specific optional dep issues)
COPY front/package.json ./

# Install dependencies without optional (abletonlink native module doesn't build on Linux)
# The server plugin gracefully handles missing abletonlink
RUN npm install --omit=optional

# Copy the rest of the frontend code
COPY front/ ./

# Expose the dev server port
EXPOSE 3010

# Run dev server (accessible from host)
CMD ["npm", "run", "dev", "--", "--host", "0.0.0.0"]
