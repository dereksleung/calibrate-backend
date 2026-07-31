import { AuthenticationError, RateLimitError, ServiceUnavailableError } from "@application";
import { BusinessLogicError } from "@domain/errors/business-logic-error.js";
import { Response } from "express";

export function handleControllerError(error: unknown, res: Response): void {
  if (error instanceof Error) {
    if (error instanceof AuthenticationError) {
      res.status(401).json({ error: error.message });
      return;
    }
    if (error instanceof RateLimitError) {
      res.status(429).json({ error: error.message });
      return;
    }
    if (error instanceof ServiceUnavailableError) {
      res.status(503).json({ error: error.message });
      return;
    }
    if (error.message.includes("not found")) {
      res.status(404).json({ error: "Resource not found" });
      return;
    }
    if (error.message.includes("permission")) {
      res.status(403).json({ error: "Permission denied" });
      return;
    }
    if (error instanceof BusinessLogicError) {
      res.status(400).json({ error: error.message });
      return;
    }
    res.status(500).json({ error: error.message });
  } else {
    res.status(500).json({ error: "An unknown error occurred" });
  }
}
