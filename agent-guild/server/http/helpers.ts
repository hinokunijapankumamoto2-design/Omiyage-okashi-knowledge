import type { NextFunction, Request, Response } from "express";
import { AppError } from "../core/errors.js";
import { createLogger } from "../core/logger.js";

const log = createLogger("http");

/** Wraps an async handler so a rejected promise reaches the error middleware. */
export function handler<T>(fn: (req: Request, res: Response) => Promise<T> | T) {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      const result = await fn(req, res);
      if (!res.headersSent && result !== undefined) res.json(result);
    } catch (error) {
      next(error);
    }
  };
}

export function errorMiddleware(error: unknown, _req: Request, res: Response, _next: NextFunction): void {
  if (error instanceof AppError) {
    res.status(error.status).json({ error: error.code, message: error.message, details: error.details });
    return;
  }
  const message = error instanceof Error ? error.message : String(error);
  log.error("unhandled error", message);
  res.status(500).json({ error: "internal_error", message });
}

export function body(req: Request): Record<string, unknown> {
  return (req.body ?? {}) as Record<string, unknown>;
}

export function str(req: Request, key: string): string | undefined {
  const value = req.query[key];
  return typeof value === "string" && value !== "" ? value : undefined;
}

export function flag(req: Request, key: string): boolean {
  return str(req, key) === "1" || str(req, key) === "true";
}

/** Express 5 types route params as `string | string[]`; collapse to the first value. */
export function param(req: Request, key: string): string {
  const value = (req.params as Record<string, string | string[]>)[key];
  return Array.isArray(value) ? (value[0] ?? "") : (value ?? "");
}
