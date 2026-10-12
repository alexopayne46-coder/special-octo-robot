import { serve } from "bun";
import index from "./index.html";
import { logger } from "../src/core/logger";
import { HttpPlayAdapter } from "../src/adapters/http-play/adapter";


const isProd = process.env.NODE_ENV === "production";
const PORT = Number(process.env.PORT ?? 3000);
const MAX_JSON_BYTES = 1 * 1024 * 1024;
const MAX_IMPORT_BYTES = 10 * 1024 * 1024;
const SHUTDOWN_TIMEOUT_MS = 10_000;

const httpPlayAdapter = new HttpPlayAdapter();



class AppError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
    public readonly details?: unknown
  ) {
    super(message);
    this.name = "AppError";
  }
}


function normalizeError(err: unknown): AppError | null {
  if (err instanceof AppError) return err;
  return null;
}


type Log = typeof logger;
type RouteContext = { log: Log; reqId: string };
type RouteHandler = (req: Request, ctx: RouteContext) => Promise<unknown>;

function json(data: unknown, status = 200, headers: Record<string, string> = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json", ...headers },
  });
}

async function readJsonBody(req: Request): Promise<Record<string, unknown>> {
  const declared = Number(req.headers.get("content-length") ?? 0);
  if (declared > MAX_JSON_BYTES) {
    throw new AppError(413, "PAYLOAD_TOO_LARGE", "Request body too large");
  }

  const text = await req.text();
  if (Buffer.byteLength(text) > MAX_JSON_BYTES) {
    throw new AppError(413, "PAYLOAD_TOO_LARGE", "Request body too large");
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new AppError(400, "INVALID_JSON", "Request body is not valid JSON");
  }

  if (parsed === null || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new AppError(400, "INVALID_BODY", "Request body must be a JSON object");
  }
  return parsed as Record<string, unknown>;
}


function route(method: string, handler: RouteHandler) {
  return async (
    req: Request,
    srv?: { requestIP?: (r: Request) => { address: string } | null }
  ): Promise<Response> => {
    const startedAt = performance.now();
    const url = new URL(req.url);
    const reqId = (req.headers.get("x-request-id") ?? "").slice(0, 64) || crypto.randomUUID();
    const log = logger.child({ reqId });
    const baseMeta = {
      method: req.method,
      path: url.pathname,
      ip: srv?.requestIP?.(req)?.address,
    };

    log.debug(baseMeta, "request started");

    let response: Response;
    try {
      if (req.method !== method) {
        response = json(
          { success: false, error: "Method not allowed", code: "METHOD_NOT_ALLOWED", requestId: reqId },
          405,
          { Allow: method }
        );
      } else {
        const result = await handler(req, { log, reqId });
        response = json(result);
      }
    } catch (err) {
      const appErr = normalizeError(err);

      if (appErr) {
        log.warn({ err, code: appErr.code }, "request rejected");
        response = json(
          {
            success: false,
            error: appErr.message,
            code: appErr.code,
            requestId: reqId,
            ...(appErr.details !== undefined && { details: appErr.details }),
          },
          appErr.status
        );
      } else {
        log.error({ err }, "unhandled error in request handler");
        response = json(
          { success: false, error: "Internal server error", code: "INTERNAL_ERROR", requestId: reqId },
          500
        );
      }
    }

    response.headers.set("X-Request-Id", reqId);

    const durationMs = Math.round(performance.now() - startedAt);
    const level = response.status >= 500 ? "error" : response.status >= 400 ? "warn" : "info";
    log[level]({ ...baseMeta, status: response.status, durationMs }, "request completed");

    return response;
  };
}


const handlePlay: RouteHandler = async (req, { log }) => {
  const body = await readJsonBody(req);
  log.debug({ body }, "processing /api/play");
  return httpPlayAdapter.handleRequest(body);
};

const handleImport: RouteHandler = async (req, { log }) => {
  let formData: FormData;
  try {
    formData = await req.formData();
  } catch {
    throw new AppError(400, "INVALID_FORM_DATA", "Request body is not valid form data");
  }

  const file = formData.get("file");
  if (!(file instanceof File)) {
    throw new AppError(400, "NO_FILE", "No file provided");
  }
  if (file.size === 0) {
    throw new AppError(400, "EMPTY_FILE", "Uploaded file is empty");
  }
  if (file.size > MAX_IMPORT_BYTES) {
    throw new AppError(413, "FILE_TOO_LARGE", `File exceeds ${MAX_IMPORT_BYTES / 1024 / 1024} MB limit`);
  }

  const importType = formData.get("type");
  if (typeof importType !== "string" || importType.length === 0) {
    throw new AppError(400, "MISSING_TYPE", "Import type is required");
  }

  const clearBeforeImport = formData.get("clearBeforeImport") === "true";
  const rawGroupName = formData.get("groupName");
  const groupName = typeof rawGroupName === "string" ? rawGroupName : undefined;

  log.info(
    { importType, clearBeforeImport, groupName, fileName: file.name, fileSize: file.size },
    "processing /api/import"
  );

  return httpPlayAdapter.handleImport(file, importType, clearBeforeImport, groupName);
};

export class WebkitServer {
  private server: ReturnType<typeof serve>;
  private shuttingDown = false;

  async shutdown(signal: string, exitCode = 0) {
    if (this.shuttingDown) return;
    this.shuttingDown = true;
    logger.info({ signal }, "shutting down");

    setTimeout(() => {
      logger.error("graceful shutdown timed out, forcing exit");
      process.exit(1);
    }, SHUTDOWN_TIMEOUT_MS).unref();

    try {
      await this.server.stop();
      logger.info("server stopped");
    } catch (err) {
      logger.error({ err }, "error while stopping server");
      exitCode = 1;
    }
    process.exit(exitCode);
  }

  constructor() {
    this.server = serve({
      hostname: isProd ? "0.0.0.0" : "localhost",
      port: PORT,
      http3: true, 
      http2: true, 
      tls: {
        key: Bun.file("./data/key.pem"),
        cert: Bun.file("./data/cert.pem"),
      },
      routes: {
        "/api/play": route("POST", handlePlay),
        "/api/import": route("POST", handleImport),
        "/health": () => new Response("OK", { status: 200 }),
        "/": index,
        "/*": index,
      },

      error(err) {
        logger.error({ err }, "unhandled server error");
        return json({ success: false, error: "Internal server error", code: "INTERNAL_ERROR" }, 500);
      },

      development: !isProd && {
        hmr: true,
        console: true,
      },
    });


    logger.info({ url: this.server.url.toString(), env: process.env.NODE_ENV ?? "development" }, "server running");

    process.on("SIGINT", () => void this.shutdown("SIGINT"));
    process.on("SIGTERM", () => void this.shutdown("SIGTERM"));

    process.on("unhandledRejection", (reason) => {
      logger.error({ err: reason }, "unhandled promise rejection");
    });

    process.on("uncaughtException", (err) => {
      logger.fatal({ err }, "uncaught exception");
      void this.shutdown("uncaughtException", 1);
    });
  }
}



