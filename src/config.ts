export const isProd = process.env.NODE_ENV === "production";
export const HOST = process.env.HOST || (isProd ? "0.0.0.0" : "localhost");
export const PORT = Number(process.env.PORT ?? 3000);
export const MAX_JSON_BYTES = 1 * 1024 * 1024;
export const MAX_IMPORT_BYTES = 10 * 1024 * 1024;
export const SHUTDOWN_TIMEOUT_MS = 10_000;

export const DATABASE_URL =
  process.env.DATABASE_URL ?? "postgres://pg:pg@localhost:5432/pg";

export const tlsBun = {
  key: isProd ? Bun.file("/certs/key.pem") : Bun.file("./data/certs/key.pem"),
  cert: isProd ? Bun.file("/certs/cert.pem") : Bun.file("./data/certs/cert.pem"),
};