import cors from "cors";
import express, { type Express } from "express";
import { authRouter } from "./auth/routes.js";
import { productsRouter } from "./products/routes.js";
import { cartRouter } from "./cart/routes.js";
import { ordersRouter } from "./orders/routes.js";
import { aiRouter } from "./ai/routes.js";
import { mountGraphQL } from "./graphql/server.js";
import { errorHandler } from "./middleware/errorHandler.js";
import { requestLogger, requestMetrics } from "./middleware/requestLogger.js";
import { registry } from "./observability/metrics.js";

export async function createApp(): Promise<Express> {
  const app = express();

  app.use(cors());
  app.use(express.json());
  app.use(requestLogger);
  app.use(requestMetrics);

  app.get("/health", (_req, res) => {
    res.json({ status: "ok" });
  });

  app.get("/metrics", async (_req, res) => {
    res.set("Content-Type", registry.contentType);
    res.send(await registry.metrics());
  });

  app.use("/api/auth", authRouter);
  app.use("/api/products", productsRouter);
  app.use("/api/cart", cartRouter);
  app.use("/api/orders", ordersRouter);
  app.use("/api/ai", aiRouter);

  await mountGraphQL(app);

  app.use(errorHandler);

  return app;
}
