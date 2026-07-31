import { UserController } from "@controllers/user-controller.js";
import { Router } from "express";

export function createUserRoutes(userController: UserController): Router {
  const router = Router();

  router.post("/users", (req, res) => userController.createUser(req, res));
  return router;
}
