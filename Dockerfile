FROM docker.io/oven/bun:latest AS deps
WORKDIR /app

# RUN apt-get update \
#     && apt-get install -y --no-install-recommends python3 make g++ \
#     && rm -rf /var/lib/apt/lists/*

COPY package.json bun.lock ./
RUN bun install --frozen-lockfile --production

FROM docker.io/oven/bun:latest-slim AS runtime
WORKDIR /app

ENV PORT=3000 \
    ENV=production \
    NODE_ENV=production

COPY --from=deps /app/node_modules ./node_modules

COPY . .

RUN mkdir -p /app/data && chown -R bun:bun /app

USER bun

EXPOSE 3000
CMD ["bun", "run", "index.ts"]