FROM mcr.microsoft.com/playwright:v1.44.1-jammy as builder

WORKDIR /usr/src/app

COPY package*.json ./
RUN npm ci

COPY tsconfig.json ./
COPY src/ ./src
RUN npm run build

FROM mcr.microsoft.com/playwright:v1.44.1-jammy

WORKDIR /usr/src/app
ENV NODE_ENV=production

COPY package*.json ./
RUN npm ci --only=production

COPY --from=builder /usr/src/app/dist ./dist

# Install additional chromium browser binaries
RUN npx playwright install chromium

EXPOSE 5000

CMD ["node", "dist/server.js"]
