import { Router } from "express";
import { requireAuth } from "../auth/middleware.js";
import { checkout, listOrders, OrderError } from "./service.js";

export const ordersRouter = Router();
ordersRouter.use(requireAuth);

ordersRouter.get("/", async (req, res, next) => {
  try {
    res.json(await listOrders(req.user!.sub));
  } catch (err) {
    next(err);
  }
});

ordersRouter.post("/", async (req, res, next) => {
  try {
    res.status(201).json(await checkout(req.user!.sub));
  } catch (err) {
    if (err instanceof OrderError) {
      res.status(400).json({ error: err.message });
      return;
    }
    next(err);
  }
});
