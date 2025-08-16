FROM node:20-alpine

WORKDIR /app

# Install system dependencies
RUN apk add --no-cache nginx bash

# Install PM2 globally
RUN npm install -g pm2

# Copy package files for better layer caching
COPY backend/package*.json ./backend/
COPY frontend/package*.json ./frontend/

# Install dependencies
RUN cd backend && npm ci --only=production
RUN cd frontend && npm ci

# Copy source code
COPY backend ./backend
COPY frontend ./frontend

# Build frontend
RUN cd frontend && npm run build

# Copy and validate nginx config
COPY nginx.conf /etc/nginx/conf.d/default.conf
RUN nginx -t

# Create required directories
RUN mkdir -p /run/nginx /var/log/nginx

# Create startup script
RUN echo '#!/bin/bash\n\
set -e\n\
echo "Starting nginx..."\n\
nginx\n\
echo "Starting backend with PM2..."\n\
cd /app\n\
exec pm2-runtime start backend/server.js --name backend --no-daemon\n\
' > /app/start.sh && chmod +x /app/start.sh

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD curl -f http://localhost:5173/ || exit 1

# Expose the port nginx is listening on
EXPOSE 5173

# Use the startup script
CMD ["/app/start.sh"]