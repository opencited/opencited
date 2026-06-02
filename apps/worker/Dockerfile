FROM node:24-slim AS base

RUN apt-get update && apt-get install -y --no-install-recommends \
    wget \
    ca-certificates \
    fonts-liberation \
    libasound2 \
    libatk-bridge2.0-0 \
    libatk1.0-0 \
    libc6 \
    libcairo2 \
    libcups2 \
    libdbus-1-3 \
    libexpat1 \
    libfontconfig1 \
    libgbm1 \
    libgcc-s1 \
    libglib2.0-0 \
    libgtk-3-0 \
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

# ---
FROM base AS prepare

RUN npm install -g turbo@2.9.6

COPY . .

RUN turbo prune @opencited/worker --docker

# ---
FROM base AS builder

COPY --from=prepare /app/out/json/ .

RUN bun install

COPY --from=prepare /app/out/full/ .

RUN bun turbo build --filter=@opencited/worker

RUN cd packages/browser-crawler && bunx camoufox-js fetch

# ---
FROM base AS runner

COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/bun.lock ./bun.lock
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/packages ./packages
COPY --from=builder /app/apps/worker ./apps/worker
COPY --from=builder /root/.cache/camoufox /root/.cache/camoufox

EXPOSE 3001

CMD ["bun", "run", "--filter=@opencited/worker", "start"]
