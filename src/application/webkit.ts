import { serve } from "bun";
import index from "../../webkit/index.html";
import { logger } from "../core/logger";
import { HttpPlayAdapter } from "../adapters/http-play/adapter";
import { isProd, PORT, MAX_JSON_BYTES, MAX_IMPORT_BYTES, SHUTDOWN_TIMEOUT_MS, tlsBun, HOST } from "../config";

export interface WebKitOptions {
  /** Enable TLS. Defaults to true. */
  tls?: boolean;
  /** Enable HTTP/3 (QUIC). Requires TLS. Defaults to true. */
  http3?: boolean;
}

export class WebKit {
  private static AppError = class extends Error {
    constructor(
      public readonly status: number,
      public readonly code: string,
      message: string,
      public readonly details?: unknown,
    ) {
      super(message);
      this.name = "AppError";
    }
  };

  private httpPlayAdapter: HttpPlayAdapter;
  private server: ReturnType<typeof serve> | undefined;
  private shuttingDown = false;

  constructor() {
    this.httpPlayAdapter = new HttpPlayAdapter();
  }

  private static normalizeError(err: unknown): WebKit["AppError"] | null {
    if (err instanceof WebKit.AppError) return err;
    return null;
  }

  private static json(data: unknown, status = 200, headers: Record<string, string> = {}): Response {
    return new Response(JSON.stringify(data), {
      status,
      headers: { "Content-Type": "application/json", ...headers },
    });
  }

  private async readJsonBody(req: Request): Promise<Record<string, unknown>> {
    const declared = Number(req.headers.get("content-length") ?? 0);
    if (declared > MAX_JSON_BYTES) {
      throw new WebKit.AppError(413, "PAYLOAD_TOO_LARGE", "Request body too large");
    }

    const text = await req.text();
    if (Buffer.byteLength(text) > MAX_JSON_BYTES) {
      throw new WebKit.AppError(413, "PAYLOAD_TOO_LARGE", "Request body too large");
    }

    let parsed: unknown;
    try {
      parsed = JSON.parse(text);
    } catch {
      throw new WebKit.AppError(400, "INVALID_JSON", "Request body is not valid JSON");
    }

    if (parsed === null || typeof parsed !== "object" || Array.isArray(parsed)) {
      throw new WebKit.AppError(400, "INVALID_BODY", "Request body must be a JSON object");
    }
    return parsed as Record<string, unknown>;
  }

  private route(method: string, handler: (req: Request, ctx: { log: typeof logger; reqId: string }) => Promise<unknown>) {
    return async (
      req: Request,
      srv?: { requestIP?: (r: Request) => { address: string } | null },
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
          response = WebKit.json(
            { success: false, error: "Method not allowed", code: "METHOD_NOT_ALLOWED", requestId: reqId },
            405,
            { Allow: method },
          );
        } else {
          const result = await handler(req, { log, reqId });
          response = WebKit.json(result);
        }
      } catch (err) {
        const appErr = WebKit.normalizeError(err);

        if (appErr) {
          log.warn({ err, code: appErr.code }, "request rejected");
          response = WebKit.json(
            {
              success: false,
              error: appErr.message,
              code: appErr.code,
              requestId: reqId,
              ...(appErr.details !== undefined && { details: appErr.details }),
            },
            appErr.status,
          );
        } else {
          log.error({ err }, "unhandled error in request handler");
          response = WebKit.json(
            { success: false, error: "Internal server error", code: "INTERNAL_ERROR", requestId: reqId },
            500,
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

  private async handlePlay(req: Request, ctx: { log: typeof logger; reqId: string }): Promise<unknown> {
    const body = await this.readJsonBody(req);
    ctx.log.debug({ body }, "processing /api/play");
    return this.httpPlayAdapter.handleRequest(body);
  }

  private async handleImport(req: Request, ctx: { log: typeof logger; reqId: string }): Promise<unknown> {
    let formData: FormData;
    try {
      formData = await req.formData();
    } catch {
      throw new WebKit.AppError(400, "INVALID_FORM_DATA", "Request body is not valid form data");
    }

    const file = formData.get("file");
    if (!(file instanceof File)) {
      throw new WebKit.AppError(400, "NO_FILE", "No file provided");
    }
    if (file.size === 0) {
      throw new WebKit.AppError(400, "EMPTY_FILE", "Uploaded file is empty");
    }
    if (file.size > MAX_IMPORT_BYTES) {
      throw new WebKit.AppError(413, "FILE_TOO_LARGE", `File exceeds ${MAX_IMPORT_BYTES / 1024 / 1024} MB limit`);
    }

    const importType = formData.get("type");
    if (typeof importType !== "string" || importType.length === 0) {
      throw new WebKit.AppError(400, "MISSING_TYPE", "Import type is required");
    }

    const clearBeforeImport = formData.get("clearBeforeImport") === "true";
    const rawGroupName = formData.get("groupName");
    const groupName = typeof rawGroupName === "string" ? rawGroupName : undefined;
    const rawProxyId = formData.get("proxyId");
    const proxyId =
      typeof rawProxyId === "string" && rawProxyId.trim() !== "" && Number.isFinite(Number(rawProxyId))
        ? Number(rawProxyId)
        : undefined;

    ctx.log.info(
      { importType, clearBeforeImport, groupName, proxyId, fileName: file.name, fileSize: file.size },
      "processing /api/import",
    );

    return this.httpPlayAdapter.handleImport(file, importType, clearBeforeImport, groupName, proxyId);
  }

  async shutdown(signal: string, exitCode = 0) {
    if (this.shuttingDown) return;
    this.shuttingDown = true;
    logger.info({ signal }, "shutting down");

    setTimeout(() => {
      logger.error("graceful shutdown timed out, forcing exit");
      process.exit(1);
    }, SHUTDOWN_TIMEOUT_MS).unref();

    try {
      await this.server?.stop();
      logger.info("server stopped");
    } catch (err) {
      logger.error({ err }, "error while stopping server");
      exitCode = 1;
    }
    process.exit(exitCode);
  }

  async start(options: WebKitOptions = {}): Promise<void> {
    const useTls = options.tls ?? true;
    const useHttp3 = options.http3 ?? true;

    this.server = serve({
      hostname: HOST,
      port: PORT,
      http3: useHttp3 && useTls,
      http2: useTls,
      tls: useTls ? tlsBun : undefined,
      routes: {
        "/api/play": this.route("POST", this.handlePlay.bind(this)),
        "/api/import": this.route("POST", this.handleImport.bind(this)),
        "/health": () => new Response("OK", { status: 200 }),
        "/": index,
        "/*": index,
      },

      error(err) {
        logger.error({ err }, "unhandled server error");
        return WebKit.json({ success: false, error: "Internal server error", code: "INTERNAL_ERROR" }, 500);
      },

      development: !isProd && {
        hmr: true,
        console: true,
      },
    });

    logger.info({ url: this.server.url.toString(), env: process.env.NODE_ENV ?? "development" }, "server running");

    process.on("SIGINT", () => void this.shutdown("SIGINT"));
    process.on("SIGTERM", () => void this.shutdown("SIGTERM"));
  }
}
