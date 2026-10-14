FROM docker.io/oven/bun:latest AS deps
WORKDIR /app

RUN apt-get update \
    && apt-get install -y --no-install-recommends python3 make g++ \
    && rm -rf /var/lib/apt/lists/*

COPY package.json bun.lock ./
RUN bun install --frozen-lockfile --production

FROM docker.io/oven/bun:latest AS build
WORKDIR /app

COPY --from=deps /app/node_modules ./node_modules
COPY . .

RUN bun build index.ts --outdir dist --target=bun \
    && cp package.json dist/

FROM docker.io/oven/bun:latest AS runtime
WORKDIR /app

ENV PORT=3000 \
    ENV=production \
    NODE_ENV=production

COPY --from=deps /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist

RUN mkdir -p /certs \
    && openssl req -x509 -newkey rsa:2048 -nodes -keyout /certs/key.pem -out /certs/cert.pem -days 365 -subj "/CN=localhost"

EXPOSE 3000
CMD ["bun", "run", "dist/index.js", "--no-tls", "--host=0.0.0.0", "--port=3000"]
