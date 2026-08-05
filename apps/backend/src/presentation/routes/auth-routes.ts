import { AuthController } from "@controllers/auth-controller.js";
import { Router } from "express";

export function createAuthRoutes(authController: AuthController): Router {
  const router = Router();

  router.post("/auth/email-verification", (req, res) =>
    authController.requestAccountEmailVerification(req, res),
  );
  router.post("/auth/email-verification/verify", (req, res) =>
    authController.verifyAccountEmailVerification(req, res),
  );
  router.post("/auth/passkeys/registration/options", (req, res) =>
    authController.createPasskeyRegistrationOptions(req, res),
  );
  router.post("/auth/passkeys/registration/verify", (req, res) =>
    authController.verifyPasskeyRegistration(req, res),
  );
  router.post("/auth/passkeys/authentication/options", (req, res) =>
    authController.createPasskeyAuthenticationOptions(req, res),
  );
  router.post("/auth/passkeys/authentication/verify", (req, res) =>
    authController.verifyPasskeyAuthentication(req, res),
  );
  router.post("/auth/account-access/passkeys/authentication/options", (req, res) =>
    authController.createIdentifiedPasskeyAuthenticationOptions(req, res),
  );
  router.post("/auth/account-access/passkeys/authentication/verify", (req, res) =>
    authController.verifyIdentifiedPasskeyAuthentication(req, res),
  );
  router.post("/auth/account-access/recovery", (req, res) => authController.authorizeRecoveryRegistration(req, res));
  router.post("/auth/recovery/passkeys/registration/options", (req, res) =>
    authController.createRecoveryPasskeyRegistrationOptions(req, res),
  );
  router.get("/auth/session", (req, res) => authController.getCurrentSession(req, res));
  router.post("/auth/session/refresh", (req, res) => authController.refreshSession(req, res));
  router.delete("/auth/session", (req, res) => authController.logout(req, res));
  router.post("/auth/login", (req, res) => authController.login(req, res));
  return router;
}
