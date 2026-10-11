import { serve } from "bun";
import index from "./index.html";
import { logger } from "../src/core/logger";
import { HttpPlayAdapter } from "../src/adapters/http-play/adapter";

const httpPlayAdapter = new HttpPlayAdapter();

const server = serve({
  hostname: process.env.NODE_ENV === 'production' ? '0.0.0.0' : 'localhost',
  port: 3000,
  routes: {
    '/api/play': async (req) => {
      logger.info({ method: req.method, url: req.url }, "/api/play request");
      if (req.method !== "POST") {
        logger.warn({ method: req.method }, "Method not allowed for /api/play");
        return new Response("Method not allowed", { status: 405 });
      }

      try {
        const body = await req.json();
        logger.info({ body }, "Processing /api/play request");
        const response = await httpPlayAdapter.handleRequest(body);
        logger.info({ response }, "/api/play request completed");
        return new Response(JSON.stringify(response), {
          headers: { "Content-Type": "application/json" },
        });
      } catch (error) {
        logger.error({ error }, "Failed to handle /api/play request");
        return new Response(
          JSON.stringify({ success: false, error: "Invalid request" }),
          { status: 400, headers: { "Content-Type": "application/json" } }
        );
      }
    },
    '/api/import': async (req) => {
      logger.info({ method: req.method, url: req.url }, "/api/import request");
      if (req.method !== "POST") {
        logger.warn({ method: req.method }, "Method not allowed for /api/import");
        return new Response("Method not allowed", { status: 405 });
      }

      try {
      const formData = await req.formData();
      const file = formData.get("file") as File;
      const importType = formData.get("type") as string;
      const clearBeforeImport = formData.get("clearBeforeImport") === "true";
      const groupName = (formData.get("groupName") as string | null) ?? undefined;

      logger.info({ importType, clearBeforeImport, groupName, fileName: file?.name }, "Processing /api/import request");

      if (!file) {
        logger.warn("No file provided for /api/import");
        return new Response(
          JSON.stringify({ success: false, error: "No file provided" }),
          { status: 400, headers: { "Content-Type": "application/json" } }
        );
      }

      const response = await httpPlayAdapter.handleImport(file, importType, clearBeforeImport, groupName);
      logger.info({ response }, "/api/import request completed");
        return new Response(JSON.stringify(response), {
          headers: { "Content-Type": "application/json" },
        });
      } catch (error) {
        logger.error({ error }, "Failed to handle /api/import request");
        return new Response(
          JSON.stringify({ success: false, error: "Invalid request" }),
          { status: 400, headers: { "Content-Type": "application/json" } }
        );
      }
    },
    "/*": (req) => {
      logger.info({ method: req.method, url: req.url }, "Serving static content");
      return index;
    },
  },

  development: process.env.NODE_ENV !== "production" && {
    hmr: true,
    console: true,
  },
});

logger.info({ url: server.url }, "Server running at");
