FROM node:20-alpine

WORKDIR /app

# Install dependencies: nginx + bash (for shell scripts, optional)
RUN apk add --no-cache nginx bash

# Install pm2
RUN npm install -g pm2

COPY backend/package*.json ./backend/
COPY frontend/package*.json ./frontend/

RUN cd backend && npm install
RUN cd frontend && npm install

COPY backend ./backend
COPY frontend ./frontend

RUN cd frontend && npm run build

# Copy nginx config
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Create nginx runtime dirs
RUN mkdir -p /run/nginx

EXPOSE 5173

# Start nginx + backend with pm2
CMD nginx && \
    pm2-runtime start backend/server.js --name backend --watch
