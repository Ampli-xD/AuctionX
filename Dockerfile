FROM node:18

WORKDIR /app

# Install system dependencies
RUN apt-get update && apt-get install -y \
    nginx \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Install PM2 globally
RUN npm install -g pm2

# Copy package files first for better caching
COPY backend/package*.json ./backend/
COPY frontend/package*.json ./frontend/

# Install backend dependencies
RUN cd backend && npm install --production

# Install frontend dependencies with verbose logging
RUN cd frontend && \
    npm install --verbose --legacy-peer-deps

# Copy source code
COPY backend ./backend
COPY frontend ./frontend

# Build frontend with detailed logging
RUN cd frontend && \
    echo "=== Checking installed packages ===" && \
    ls -la node_modules/@radix-ui/ | head -20 && \
    echo "=== Building frontend ===" && \
    NODE_ENV=production npm run build -- --logLevel info

# Verify build succeeded
RUN ls -la frontend/dist/ && \
    echo "Build files:" && \
    ls frontend/dist/

# Copy nginx config
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Test nginx config
RUN nginx -t

# Create startup script
RUN echo '#!/bin/bash\n\
set -e\n\
echo "Starting nginx..."\n\
service nginx start\n\
echo "Starting backend..."\n\
cd /app/backend\n\
exec pm2-runtime start server.js --name backend --no-daemon\n\
' > /app/start.sh && chmod +x /app/start.sh

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=30s --retries=3 \
  CMD curl -f http://localhost:5173/health || curl -f http://localhost:5173/ || exit 1

EXPOSE 5173

CMD ["/app/start.sh"]