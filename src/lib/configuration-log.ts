import type { ApplicationModeResolution } from "@/lib/env";
import { logger } from "@/lib/logger";

const loggedContexts = new Set<string>();

export function logConfigurationUnavailableOnce(
  context: string,
  resolution: ApplicationModeResolution,
): void {
  if (loggedContexts.has(context)) return;
  loggedContexts.add(context);
  logger.error("Application configuration is unavailable", {
    context,
    issues: resolution.issues.join(","),
  });
}
