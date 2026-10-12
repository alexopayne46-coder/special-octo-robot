FROM docker.io/oven/bun:latest
WORKDIR /app
COPY package.json bun.lock ./
RUN apt-get update && apt-get install -y python3 make g++ && rm -rf /var/lib/apt/lists/*
RUN bun install --production --verbose
COPY . .
RUN mkdir -p /app/data
ENV PORT=3000
ENV ENV=production
ENV NODE_ENV=production
EXPOSE 3000
CMD ["bun", "run", "index.ts"]
