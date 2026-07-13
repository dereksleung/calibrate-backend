import { AuthController } from "@controllers";
import { Router } from "express";

export function createAuthRoutes(authController: AuthController): Router {
  const router = Router();

  router.post("/auth/email-otp", (req, res) => authController.requestEmailOtp(req, res));
  router.post("/auth/email-otp/verify", (req, res) => authController.verifyEmailOtp(req, res));
  router.post("/auth/login", (req, res) => authController.login(req, res));
  return router;
}
