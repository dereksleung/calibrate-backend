import { Container } from "@infrastructure/container.js";
import { createAuthenticationMiddleware } from "@presentation/middleware/auth-middleware.js";
import { createAuthRoutes } from "@routes/auth-routes.js";
import { createDayLogRoutes } from "@routes/day-log-routes.js";
import { createUserRoutes } from "@routes/user-routes.js";
import cors from "cors";
import express from "express";
import helmet from "helmet";
import morgan from "morgan";

const app = express();
const PORT = process.env.PORT || 3001;
const container = new Container({});

// Middleware
app.set("trust proxy", container.getTrustProxyHops());
app.use(helmet());
app.use(
  cors({
    origin: process.env.NODE_ENV === "production" ? false : "http://localhost:3000",
    credentials: true,
  }),
);
app.use(morgan(":method :url :status :res[content-length] - :response-time ms"));
app.use(express.json());

const authenticateRequest = createAuthenticationMiddleware(
  container.getAccessTokenService(),
  container.getAccessSessionRepository(),
  container.getClock(),
);

// Routes
app.use("/api/v1", createAuthRoutes(container.getAuthController()));
app.use("/api/v1", createDayLogRoutes(container.getDayLogController(), authenticateRequest));
app.use("/api/v1", createUserRoutes(container.getUserController()));

// Health check route
app.get("/health", (req, res) => {
  res.json({ status: "OK", timestamp: new Date().toISOString() });
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
export default app;
