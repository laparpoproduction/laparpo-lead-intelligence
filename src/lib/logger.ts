type LogContext = Record<string, boolean | number | string | null | undefined>;

const logLevels = ["debug", "info", "warn", "error"] as const;
type LogLevel = (typeof logLevels)[number];

function configuredLevel(): LogLevel {
  const level = process.env.LOG_LEVEL;
  return logLevels.includes(level as LogLevel) ? (level as LogLevel) : "info";
}

function write(level: LogLevel, message: string, context?: LogContext) {
  if (logLevels.indexOf(level) < logLevels.indexOf(configuredLevel())) return;

  const entry = JSON.stringify({
    level,
    message,
    context,
    timestamp: new Date().toISOString(),
  });

  if (level === "error") {
    console.error(entry);
    return;
  }

  if (level === "warn") {
    console.warn(entry);
    return;
  }

  console.info(entry);
}

export const logger = {
  debug: (message: string, context?: LogContext) => write("debug", message, context),
  error: (message: string, context?: LogContext) => write("error", message, context),
  info: (message: string, context?: LogContext) => write("info", message, context),
  warn: (message: string, context?: LogContext) => write("warn", message, context),
};
