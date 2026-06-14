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
RUN npm ci --omit=dev

COPY --from=builder /usr/src/app/dist ./dist

# Copy sql.js WASM binary (required at runtime)
COPY --from=builder /usr/src/app/node_modules/sql.js/dist/sql-wasm.wasm ./node_modules/sql.js/dist/sql-wasm.wasm

# Install chromium browser binaries for Playwright
RUN npx playwright install chromium

# Create data directory for SQLite persistence
RUN mkdir -p /usr/src/app/data

EXPOSE 5000

CMD ["node", "dist/server.js"]
