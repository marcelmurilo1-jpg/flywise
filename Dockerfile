FROM node:20-slim

# Dependências de sistema para o Chromium (Playwright)
RUN apt-get update && apt-get install -y \
    libnss3 libatk1.0-0 libatk-bridge2.0-0 libcups2 libdrm2 \
    libxkbcommon0 libxcomposite1 libxdamage1 libxfixes3 libxrandr2 \
    libgbm1 libasound2 libpango-1.0-0 libcairo2 ca-certificates \
    --no-install-recommends \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY package*.json ./
RUN npm ci --omit=dev

# Instala Chromium no build (fica disponível em runtime no mesmo container)
ENV PLAYWRIGHT_BROWSERS_PATH=/app/.playwright-browsers
RUN node node_modules/.bin/playwright install chromium

COPY . .

EXPOSE 3001
CMD ["node", "server.js"]
