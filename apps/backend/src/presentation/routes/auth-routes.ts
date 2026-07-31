import { AuthController } from "@controllers/auth-controller.js";
import { Router } from "express";

export function createAuthRoutes(authController: AuthController): Router {
  const router = Router();

  router.post("/auth/email-verification", (req, res) =>
    authController.requestSignupEmailVerification(req, res),
  );
  router.post("/auth/email-verification/verify", (req, res) =>
    authController.verifySignupEmailVerification(req, res),
  );
  router.post("/auth/login", (req, res) => authController.login(req, res));
  return router;
}
