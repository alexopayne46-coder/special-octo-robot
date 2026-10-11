import { serve } from "bun";
import index from "./index.html";
import { logger } from "../src/core/logger";
import { HttpPlayAdapter } from "../src/adapters/http-play/adapter";

const httpPlayAdapter = new HttpPlayAdapter();

const server = serve({
  hostname: '0.0.0.0',
  port: 3000,
  routes: {
    '/api/play': async (req) => {
      if (req.method !== "POST") {
        return new Response("Method not allowed", { status: 405 });
      }

      try {
        const body = await req.json();
        const response = await httpPlayAdapter.handleRequest(body);
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
      if (req.method !== "POST") {
        return new Response("Method not allowed", { status: 405 });
      }

      try {
      const formData = await req.formData();
      const file = formData.get("file") as File;
      const importType = formData.get("type") as string;
      const clearBeforeImport = formData.get("clearBeforeImport") === "true";
      const groupName = (formData.get("groupName") as string | null) ?? undefined;

      if (!file) {
        return new Response(
          JSON.stringify({ success: false, error: "No file provided" }),
          { status: 400, headers: { "Content-Type": "application/json" } }
        );
      }

      const response = await httpPlayAdapter.handleImport(file, importType, clearBeforeImport, groupName);
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
    "/*": index,
  },

  development: process.env.NODE_ENV !== "production" && {
    hmr: true,
    console: true,
  },
});

logger.info({ url: server.url }, "Server running at");
