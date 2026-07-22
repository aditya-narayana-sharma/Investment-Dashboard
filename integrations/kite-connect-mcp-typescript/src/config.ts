import { z } from "zod";

const ConfigSchema = z.object({
  apiKey: z.string().optional(),
  apiSecret: z.string().optional(),
  accessToken: z.string().optional(),
  baseUrl: z.string().url().default("https://api.kite.trade"),
  rateLimitRps: z.coerce.number().positive().max(10).default(3),
  requestTimeoutMs: z.coerce.number().int().positive().default(15000),
  logLevel: z.enum(["debug", "info", "warn", "error"]).default("info")
});

export type Config = z.infer<typeof ConfigSchema>;

export function loadConfig(): Config {
  return ConfigSchema.parse({
    apiKey: process.env.KITE_API_KEY,
    apiSecret: process.env.KITE_API_SECRET,
    accessToken: process.env.KITE_ACCESS_TOKEN,
    baseUrl: process.env.KITE_BASE_URL,
    rateLimitRps: process.env.KITE_RATE_LIMIT_RPS,
    requestTimeoutMs: process.env.KITE_REQUEST_TIMEOUT_MS,
    logLevel: process.env.KITE_LOG_LEVEL
  });
}
