type LogContext = Record<string, boolean | number | string | null | undefined>;

function write(level: "error" | "info" | "warn", message: string, context?: LogContext) {
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
  error: (message: string, context?: LogContext) => write("error", message, context),
  info: (message: string, context?: LogContext) => write("info", message, context),
  warn: (message: string, context?: LogContext) => write("warn", message, context),
};
