import Fastify from "fastify";
import type { HealthResponse, ReadinessResponse } from "@snode/contracts";
import { createDatabase, sql } from "@snode/db";

export function buildApp(options: { databaseUrl?: string; logger?: boolean } = {}) {
  const app = Fastify({ logger: options.logger ?? false });
  const database = options.databaseUrl ? createDatabase(options.databaseUrl) : undefined;

  app.get<{ Reply: HealthResponse }>("/api/health", async () => ({
    status: "ok",
    service: "snode-api",
  }));

  app.get<{ Reply: ReadinessResponse }>("/api/ready", async (_request, reply) => {
    if (!database) {
      return reply.code(503).send({ status: "unavailable", database: "not_configured" });
    }
    try {
      await database.db.execute(sql`select 1`);
      return { status: "ok", database: "connected" };
    } catch (error) {
      app.log.error({ err: error }, "Database readiness check failed");
      return reply.code(503).send({ status: "unavailable", database: "unreachable" });
    }
  });

  app.addHook("onClose", async () => {
    await database?.pool.end();
  });

  return app;
}
