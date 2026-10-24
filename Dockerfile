FROM node:24-alpine
WORKDIR /app
COPY package*.json ./
RUN npm install --omit=dev
COPY bot ./bot
COPY lib ./lib
USER node
CMD ["node","bot/index.js"]
