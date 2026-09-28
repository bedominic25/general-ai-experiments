import { pinoHttp } from "pino-http";
import type { NextFunction, Request, Response } from "express";
import { logger } from "../observability/logger.js";
import { httpRequestDuration } from "../observability/metrics.js";

export const requestLogger = pinoHttp({
  logger,
  customSuccessMessage: (req, res) => `${req.method} ${req.url} -> ${res.statusCode}`,
});

export function requestMetrics(req: Request, res: Response, next: NextFunction): void {
  const end = httpRequestDuration.startTimer();
  res.on("finish", () => {
    end({ method: req.method, route: req.route?.path ?? req.path, status_code: String(res.statusCode) });
  });
  next();
}
