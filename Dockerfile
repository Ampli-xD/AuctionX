FROM node:20

WORKDIR /app

RUN npm install -g pm2

COPY backend/package*.json ./backend/
COPY frontend/package*.json ./frontend/

RUN cd backend && npm install
RUN cd frontend && npm install

COPY backend ./backend
COPY frontend ./frontend

RUN cd frontend && npm run build

EXPOSE 3000 5173

CMD ["pm2-runtime", "start", "backend/server.js", "--name", "backend", "--watch", "--interpreter", "node", "--", "frontend/server.js", "--name", "frontend", "--watch"]

