import type { NextFunction, Request, Response } from "express";
import { logger } from "../observability/logger.js";

export function errorHandler(err: unknown, req: Request, res: Response, _next: NextFunction): void {
  logger.error({ err, path: req.path, method: req.method }, "Unhandled request error");
  res.status(500).json({ error: "Internal server error" });
}
