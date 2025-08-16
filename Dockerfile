# Multi-stage build for better optimization
FROM node:18-alpine AS builder

WORKDIR /app

# Copy package files
COPY backend/package*.json ./backend/
COPY frontend/package*.json ./frontend/

# Install dependencies (including dev dependencies for TypeScript compilation)
RUN cd backend && npm ci
RUN cd frontend && npm ci --legacy-peer-deps

# Copy source code
COPY backend ./backend
COPY frontend ./frontend

# Build backend TypeScript
RUN cd backend && npm run build

# Build frontend
RUN cd frontend && \
    NODE_ENV=production npm run build

# Production stage
FROM node:18-alpine AS production

WORKDIR /app

# Install system dependencies
RUN apk add --no-cache \
    nginx \
    curl \
    bash

# Install PM2 globally
RUN npm install -g pm2

# Copy built application and production dependencies only
COPY --from=builder /app/backend/dist ./backend/dist
COPY --from=builder /app/backend/package*.json ./backend/
COPY --from=builder /app/frontend/dist ./frontend/dist

# Install only production dependencies
RUN cd backend && npm ci --only=production

# Copy nginx configuration
COPY nginx.conf /etc/nginx/http.d/default.conf

# Test nginx configuration
RUN nginx -t

# Create startup script
RUN echo '#!/bin/bash\n\
set -e\n\
echo "Starting backend with PM2..."\n\
cd /app/backend\n\
pm2 start dist/index.js --name hono-backend --no-daemon &\n\
echo "Backend started, waiting 5 seconds..."\n\
sleep 5\n\
echo "Starting nginx..."\n\
exec nginx -g "daemon off;"\n\
' > /app/start.sh && chmod +x /app/start.sh

# Health check - adjust port as needed
HEALTHCHECK --interval=30s --timeout=10s --start-period=30s --retries=3 \
  CMD curl -f http://localhost/health || curl -f http://localhost/ || exit 1

# Expose nginx port
EXPOSE 80

# Start services
CMD ["/app/start.sh"]