FROM node:20-bookworm-slim

WORKDIR /app

COPY frontend/package*.json ./

RUN npm ci --legacy-peer-deps

COPY frontend/ .

ENV HOST=0.0.0.0
ENV PORT=3000
ENV CHOKIDAR_USEPOLLING=true
ENV WATCHPACK_POLLING=true

EXPOSE 3000

CMD ["npm", "start"]
