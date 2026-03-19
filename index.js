import cookieParser from "cookie-parser";
import cors from "cors";
import dotenv from "dotenv";
import express from "express";
import helmet from "helmet";
import morgan from "morgan";

import { connectDB } from "./src/config/db.js";
import { errorHandler, notFoundHandler } from "./src/middlewares/errorHandler.js";
import apiRoutes from "./src/routes/index.js";
import whatsappRoutes from "./src/routes/whatsappRoutes.js";
import { ensureSuperAdmin } from "./src/services/seedService.js";

dotenv.config();

const app = express();
const port = Number(process.env.PORT || 5000);

const allowedOrigins = process.env.CORS_ORIGIN
  ? process.env.CORS_ORIGIN.split(",").map((origin) => origin.trim())
  : true;

app.use(
  cors({
    origin: allowedOrigins,
    credentials: true,
  }),
);
app.use(helmet());
app.use(morgan("dev"));
app.use(express.json({ limit: "1mb" }));
app.use(cookieParser());

app.get("/", (_req, res) => {
  res.json({ service: "thai-residency-api", status: "ok" });
});

app.use("/api/whatsapp", whatsappRoutes);
app.use("/api", apiRoutes);

app.use(notFoundHandler);
app.use(errorHandler);

async function startServer() {
  await connectDB();
  await ensureSuperAdmin();

  app.listen(port, () => {
    console.log(`API running on port ${port}`);
  });
}

startServer().catch((error) => {
  console.error("Failed to start server", error);
  process.exit(1);
});
