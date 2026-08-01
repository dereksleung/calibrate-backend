import { AuthenticationError } from "@application/errors/authentication-error.js";
import { IAccessSessionRepository } from "@application/ports/access-session-repository.js";
import { IAccessTokenService } from "@application/ports/access-token-service.js";
import { IClock } from "@application/ports/clock.js";
import { NextFunction, Request, RequestHandler, Response } from "express";
import { createHash } from "node:crypto";

import { getAccessCookieConfiguration } from "../auth/access-cookie.js";
import { extractCookieValue } from "../auth/cookie-extractor.js";

function digestAccessToken(token: string): string {
  return createHash("sha256").update(token).digest("base64url");
}

export function createAuthenticationMiddleware(
  accessTokenService: IAccessTokenService,
  accessSessionRepository?: IAccessSessionRepository,
  clock?: IClock,
): RequestHandler {
  return async function authenticationMiddleware(
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> {
    const authorizationHeader = req.get("Authorization");

    if (authorizationHeader?.startsWith("Bearer ")) {
      const token = authorizationHeader.slice("Bearer ".length).trim();
      if (!token) {
        res.status(401).json({ error: "Authentication required" });
        return;
      }

      try {
        const payload = await accessTokenService.verify(token);
        req.auth = { userId: payload.userId };
        next();
        return;
      } catch (error) {
        const message = error instanceof AuthenticationError ? error.message : "Invalid or expired token";
        res.status(401).json({ error: message });
        return;
      }
    }

    if (accessSessionRepository && clock) {
      const accessCookie = getAccessCookieConfiguration();
      const cookieHeader = req.get("Cookie");
      const accessToken = extractCookieValue(cookieHeader, accessCookie.name);
      if (accessToken) {
        const userId = await accessSessionRepository.findActiveUserIdByTokenDigest(
          digestAccessToken(accessToken),
          clock.now(),
        );
        if (userId) {
          req.auth = { userId };
          next();
          return;
        }
      }
    }

    res.status(401).json({ error: "Authentication required" });
  };
}
