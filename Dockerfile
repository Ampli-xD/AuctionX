# Multi-stage build for better optimization
FROM node:18-alpine AS builder

WORKDIR /app

# Copy package files
COPY backend/package*.json ./backend/
COPY frontend/package*.json ./frontend/

# Install dependencies 
RUN cd backend && npm ci
RUN cd frontend && npm ci --legacy-peer-deps

# Copy source code
COPY backend ./backend
COPY frontend ./frontend

# Build frontend only
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

# Copy built application
COPY --from=builder /app/backend ./backend
COPY --from=builder /app/frontend/dist ./frontend/dist

# Copy nginx configuration
COPY nginx.conf /etc/nginx/http.d/default.conf

# Test nginx configuration
RUN nginx -t

RUN echo '#!/bin/bash\nset -e\necho "Starting backend with PM2..."\ncd /app/backend\npm2 start npm --name hono-backend --no-daemon -- start &\necho "Backend started, waiting 5 seconds..."\nsleep 5\necho "Starting nginx..."\nexec nginx -g "daemon off;"' > /app/start.sh && chmod +x /app/start.sh

# Health check - adjust port as needed
HEALTHCHECK --interval=30s --timeout=10s --start-period=30s --retries=3 \
  CMD curl -f http://localhost/health || curl -f http://localhost/ || exit 1

# Expose nginx port
EXPOSE 80

# Start services
CMD ["/app/start.sh"]