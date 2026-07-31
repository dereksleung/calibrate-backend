import { AuthenticationError } from "@application/errors/authentication-error.js";
import { IAccessTokenService } from "@application/ports/access-token-service.js";
import { NextFunction, Request, RequestHandler, Response } from "express";

export function createAuthenticationMiddleware(accessTokenService: IAccessTokenService): RequestHandler {
  return async function authenticationMiddleware(
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> {
    const authorizationHeader = req.get("Authorization");

    if (!authorizationHeader || !authorizationHeader.startsWith("Bearer ")) {
      res.status(401).json({ error: "Authentication required" });
      return;
    }

    const token = authorizationHeader.slice("Bearer ".length).trim();
    if (!token) {
      res.status(401).json({ error: "Authentication required" });
      return;
    }

    try {
      const payload = await accessTokenService.verify(token);
      req.auth = { userId: payload.userId };
      next();
    } catch (error) {
      const message = error instanceof AuthenticationError ? error.message : "Invalid or expired token";
      res.status(401).json({ error: message });
    }
  };
}
