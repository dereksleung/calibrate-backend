import express from "express";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";
import { createDayLogRoutes } from "@routes/day-log-routes.js";

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(helmet());
app.use(cors());
app.use(morgan("combined"));
app.use(express.json());

// Routes
app.use("/api/v1", createDayLogRoutes());

// Health check route
app.get("/health", (req, res) => {
  res.json({ status: "OK", timestamp: new Date().toISOString() });
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
export default app;
