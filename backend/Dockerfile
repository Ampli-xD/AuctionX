FROM node:20-alpine

WORKDIR /app

# Copy env vars into image
COPY .env .env

COPY package*.json ./
RUN npm install

COPY . .

EXPOSE 3000

# Default command
CMD ["npm", "run", "dev"]
