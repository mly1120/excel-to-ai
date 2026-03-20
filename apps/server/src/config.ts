import { resolve } from "node:path";

import { config as loadEnv } from "dotenv";

loadEnv({ path: resolve(process.cwd(), "../../.env") });
loadEnv();

export const config = {
  port: Number(process.env.PORT ?? 3001),
  appBaseUrl: (process.env.APP_BASE_URL ?? "http://localhost:3001").trim(),
  corsOrigin: (process.env.CORS_ORIGIN ?? "http://localhost:5173").trim(),
  aiProvider: (process.env.AI_PROVIDER ?? "mock").trim(),
  aiBaseUrl: (process.env.AI_BASE_URL ?? "").trim(),
  aiApiKey: (process.env.AI_API_KEY ?? "").trim(),
  planModel: (process.env.PLAN_MODEL ?? "").trim(),
  cellModel: (process.env.CELL_MODEL ?? "").trim(),
  aiTimeoutMs: Math.max(Number(process.env.AI_TIMEOUT_MS ?? 60000), 1000),
  aiMaxRetries: Math.max(Number(process.env.AI_MAX_RETRIES ?? 1), 0),
  planSampleRowCount: Math.max(Number(process.env.PLAN_SAMPLE_ROW_COUNT ?? 10), 1),
  cellBatchSize: Math.max(Number(process.env.CELL_BATCH_SIZE ?? 50), 1),
  maxUploadSizeMb: Number(process.env.MAX_UPLOAD_SIZE_MB ?? 20)
};
