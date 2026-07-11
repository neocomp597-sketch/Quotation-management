# --- Backend Production Dockerfile ---
FROM node:22-alpine

WORKDIR /app

# Copy dependency manifests
COPY package*.json ./
# Install production dependencies only
RUN npm ci --omit=dev

# Copy backend source code
COPY . .

# Set production environment
ENV NODE_ENV=production

# Expose backend port
EXPOSE 4003

# Run the Express server
CMD ["node", "server.js"]
