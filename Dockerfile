FROM docker.io/oven/bun:latest
WORKDIR /app
COPY package.json bun.lock ./
RUN bun install --production --ignore-scripts
COPY . .
RUN mkdir -p /app/data
ENV PORT=3000
ENV ENV=production
EXPOSE 3000
CMD ["bun", "run", "index.ts"]
