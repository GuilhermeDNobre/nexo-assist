import { z } from "zod";

const DEFAULT_AGENT_MODEL = "deepseek/deepseek-flash";
const DEFAULT_DAILY_MESSAGE_LIMIT = 30;
const DEFAULT_POLL_INTERVAL_MS = 3000;
const MINIMUM_SESSION_SECRET_LENGTH = 32;

const optionalString = z.preprocess(
  (value) => (value === "" ? undefined : value),
  z.string().min(1).optional(),
);

const numberWithDefault = (defaultValue: number) =>
  z.preprocess(
    (value) => (value === "" || value === undefined ? undefined : value),
    z.coerce.number().default(defaultValue),
  );

export const serverEnvSchema = z.object({
  DATABASE_URL: z.url(),
  DATABASE_URL_TEST: z.url(),
  SESSION_SECRET: z.string().min(MINIMUM_SESSION_SECRET_LENGTH),
  LEGACY_API_TOKEN: z.string().min(1),
  APP_BASE_URL: z.url(),
  DEEPSEEK_API_KEY: optionalString,
  AGENT_MODEL: z.string().min(1).default(DEFAULT_AGENT_MODEL),
  TYPESAFE_API_KEY: optionalString,
  LEGACY_OUTAGE_EVERY_S: numberWithDefault(0),
  LEGACY_OUTAGE_DURATION_S: numberWithDefault(0),
  LEGACY_OUTAGE_RATE: z.preprocess(
    (value) => (value === "" || value === undefined ? undefined : value),
    z.coerce.number().min(0).max(1).default(0),
  ),
  DAILY_BUDGET_USD: z.coerce.number().positive(),
  DAILY_MESSAGE_LIMIT: z.preprocess(
    (value) => (value === "" || value === undefined ? undefined : value),
    z.coerce.number().int().positive().default(DEFAULT_DAILY_MESSAGE_LIMIT),
  ),
});

export type ServerEnv = z.infer<typeof serverEnvSchema>;

export function parseServerEnv(source: Record<string, string | undefined>): ServerEnv {
  const result = serverEnvSchema.safeParse(source);
  if (result.success) {
    return result.data;
  }
  const details = result.error.issues
    .map((issue) => `${issue.path.join(".") || "env"}: ${issue.message}`)
    .join("; ");
  throw new Error(`Invalid server environment: ${details}`);
}

let cachedServerEnv: ServerEnv | undefined;

export function getServerEnv(): ServerEnv {
  if (!cachedServerEnv) {
    cachedServerEnv = parseServerEnv(process.env);
  }
  return cachedServerEnv;
}

const clientEnvSchema = z.object({
  NEXT_PUBLIC_POLL_INTERVAL_MS: z.coerce
    .number()
    .int()
    .positive()
    .catch(DEFAULT_POLL_INTERVAL_MS),
});

export const clientEnv = clientEnvSchema.parse({
  NEXT_PUBLIC_POLL_INTERVAL_MS: process.env.NEXT_PUBLIC_POLL_INTERVAL_MS,
});

export type ClientEnv = z.infer<typeof clientEnvSchema>;
