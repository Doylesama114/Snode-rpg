export interface HealthResponse {
  status: "ok";
  service: "snode-api";
}

export type ReadinessResponse =
  | { status: "ok"; database: "connected" }
  | { status: "unavailable"; database: "not_configured" | "unreachable" };

// Character and rule contracts will be added after both developers agree on them.
