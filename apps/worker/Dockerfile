FROM node:24-slim

RUN apt-get update && apt-get install -y --no-install-recommends \
    wget \
    ca-certificates \
    fonts-liberation \
    libasound2t64 \
    libatk-bridge2.0-0t64 \
    libatk1.0-0t64 \
    libc6 \
    libcairo2 \
    libcups2t64 \
    libdbus-1-3 \
    libexpat1 \
    libfontconfig1 \
    libgbm1 \
    libgcc-s1 \
    libglib2.0-0t64 \
    libgtk-3-0t64 \
    libnspr4 \
    libnss3 \
    libpango-1.0-0 \
    libpangocairo-1.0-0 \
    libstdc++6 \
    libx11-6 \
    libx11-xcb1 \
    libxcb1 \
    libxcomposite1 \
    libxcursor1 \
    libxdamage1 \
    libxext6 \
    libxfixes3 \
    libxi6 \
    libxrandr2 \
    libxrender1 \
    libxss1 \
    libxtst6 \
    lsb-release \
    xdg-utils \
    curl \
    && rm -rf /var/lib/apt/lists/*

RUN npm install -g bun@1.3.10

WORKDIR /app

COPY package.json bun.lockb ./
COPY apps/worker/package.json ./apps/worker/
COPY packages/queue/package.json ./packages/queue/
COPY packages/actions/package.json ./packages/actions/
COPY packages/browser-crawler/package.json ./packages/browser-crawler/
COPY packages/db/package.json ./packages/db/
COPY packages/crawler/package.json ./packages/crawler/
COPY packages/typescript-config/package.json ./packages/typescript-config/
COPY packages/tailwind-config/package.json ./packages/tailwind-config/
COPY packages/ui/package.json ./packages/ui/
COPY packages/trpc/package.json ./packages/trpc/

RUN bun install --frozen-lockfile

RUN bunx playwright install chromium

COPY . .

RUN bun run build --filter=@opencited/worker

EXPOSE 3001

CMD ["bun", "run", "--filter=@opencited/worker", "start"]
