FROM node:20-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY src ./src
COPY migrations ./migrations
EXPOSE 3004
CMD ["node", "src/app.js"]
