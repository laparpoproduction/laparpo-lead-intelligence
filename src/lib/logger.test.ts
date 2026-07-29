import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { logger } from "./logger";

const originalLogLevel = process.env.LOG_LEVEL;

beforeEach(() => {
  vi.spyOn(console, "info").mockImplementation(() => undefined);
  vi.spyOn(console, "warn").mockImplementation(() => undefined);
  vi.spyOn(console, "error").mockImplementation(() => undefined);
});

afterEach(() => {
  process.env.LOG_LEVEL = originalLogLevel;
  vi.restoreAllMocks();
});

describe("structured logger threshold", () => {
  it("defaults to info and suppresses debug", () => {
    delete process.env.LOG_LEVEL;
    logger.debug("hidden");
    logger.info("visible", { requestId: "request-1" });

    expect(console.info).toHaveBeenCalledTimes(1);
    expect(console.info).toHaveBeenCalledWith(
      expect.stringContaining('"requestId":"request-1"'),
    );
  });

  it("honors warn without suppressing errors", () => {
    process.env.LOG_LEVEL = "warn";
    logger.info("hidden");
    logger.warn("warning");
    logger.error("failure");

    expect(console.info).not.toHaveBeenCalled();
    expect(console.warn).toHaveBeenCalledTimes(1);
    expect(console.error).toHaveBeenCalledTimes(1);
  });

  it("enables debug explicitly", () => {
    process.env.LOG_LEVEL = "debug";
    logger.debug("diagnostic");
    expect(console.info).toHaveBeenCalledWith(
      expect.stringContaining('"level":"debug"'),
    );
  });
});
