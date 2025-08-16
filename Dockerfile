FROM node:18-alpine AS builder

WORKDIR /app

COPY backend/package*.json ./backend/
COPY frontend/package*.json ./frontend/

RUN cd backend && npm ci
RUN cd frontend && npm ci --legacy-peer-deps

COPY backend ./backend
COPY frontend ./frontend

RUN cd frontend && NODE_ENV=production npm run build

FROM node:18-alpine AS production

WORKDIR /app

RUN apk add --no-cache nginx curl bash && \
    npm install -g pm2

COPY --from=builder /app/backend ./backend
COPY --from=builder /app/frontend/dist ./frontend/dist
COPY nginx.conf /etc/nginx/http.d/default.conf

RUN nginx -t

HEALTHCHECK --interval=30s --timeout=10s --start-period=30s --retries=3 \
  CMD curl -f http://localhost/health || curl -f http://localhost/ || exit 1

EXPOSE 80

CMD ["sh", "-c", "cd /app/backend && pm2 start npm --name hono-backend & sleep 5 && nginx -g 'daemon off;'"]