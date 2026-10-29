import { describe, expect, it } from "vitest";
import { clientEnv, parseServerEnv } from "./env";

const validEnv = {
  DATABASE_URL: "postgresql://nexo:nexo@localhost:5432/nexo",
  DATABASE_URL_TEST: "postgresql://nexo:nexo@localhost:5432/nexo_test",
  SESSION_SECRET: "a".repeat(32),
  LEGACY_API_TOKEN: "legacy-token",
  APP_BASE_URL: "http://localhost:3000",
  DEEPSEEK_API_KEY: "",
  TYPESAFE_API_KEY: "",
  DAILY_BUDGET_USD: "5",
};

describe("parseServerEnv", () => {
  it("accepts a valid configuration and applies defaults", () => {
    const env = parseServerEnv(validEnv);

    expect(env.AGENT_MODEL).toBe("deepseek/deepseek-flash");
    expect(env.DAILY_MESSAGE_LIMIT).toBe(30);
    expect(env.LEGACY_OUTAGE_EVERY_S).toBe(0);
    expect(env.LEGACY_OUTAGE_DURATION_S).toBe(0);
    expect(env.LEGACY_OUTAGE_RATE).toBe(0);
    expect(env.DEEPSEEK_API_KEY).toBeUndefined();
    expect(env.TYPESAFE_API_KEY).toBeUndefined();
  });

  it("rejects a configuration without DATABASE_URL", () => {
    const invalidEnv = { ...validEnv, DATABASE_URL: undefined };

    expect(() => parseServerEnv(invalidEnv)).toThrow(/DATABASE_URL/);
  });

  it("rejects a session secret shorter than 32 characters", () => {
    const invalidEnv = { ...validEnv, SESSION_SECRET: "short" };

    expect(() => parseServerEnv(invalidEnv)).toThrow(/SESSION_SECRET/);
  });
});

describe("clientEnv", () => {
  it("exposes a positive polling interval", () => {
    expect(clientEnv.NEXT_PUBLIC_POLL_INTERVAL_MS).toBeGreaterThan(0);
  });
});
