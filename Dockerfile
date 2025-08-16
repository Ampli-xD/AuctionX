FROM node:18

WORKDIR /app

RUN apt-get update && apt-get install -y \
    nginx \
    curl \
    && rm -rf /var/lib/apt/lists/*

RUN npm install -g pm2

COPY backend/package*.json ./backend/
COPY frontend/package*.json ./frontend/

RUN cd backend && npm install --production

RUN cd frontend && \
    npm install --verbose --legacy-peer-deps

COPY backend ./backend
COPY frontend ./frontend

RUN cd frontend && \
    echo "=== Checking installed packages ===" && \
    ls -la node_modules/@radix-ui/ | head -20 && \
    echo "=== Building frontend ===" && \
    NODE_ENV=production npm run build -- --logLevel info

RUN ls -la frontend/dist/ && \
    echo "Build files:" && \
    ls frontend/dist/

COPY nginx.conf /etc/nginx/conf.d/default.conf

RUN nginx -t

RUN echo '#!/bin/bash\n\
set -e\n\
echo "Starting nginx..."\n\
service nginx start\n\
echo "Starting backend..."\n\
cd /app/backend\n\
exec pm2-runtime start server.js --name backend \n\
' > /app/start.sh && chmod +x /app/start.sh

HEALTHCHECK --interval=30s --timeout=10s --start-period=30s --retries=3 \
  CMD curl -f http://localhost:5173/health || curl -f http://localhost:5173/ || exit 1

EXPOSE 5173

CMD ["/app/start.sh"]