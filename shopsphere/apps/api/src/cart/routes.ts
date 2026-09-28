import { Router } from "express";
import { z } from "zod";
import { requireAuth } from "../auth/middleware.js";
import { addToCart, CartError, getCart, removeFromCart } from "./service.js";

export const cartRouter = Router();
cartRouter.use(requireAuth);

const addSchema = z.object({
  productId: z.string().min(1),
  quantity: z.number().int().positive().default(1),
});

cartRouter.get("/", async (req, res, next) => {
  try {
    res.json(await getCart(req.user!.sub));
  } catch (err) {
    next(err);
  }
});

cartRouter.post("/", async (req, res, next) => {
  const parsed = addSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.flatten() });
    return;
  }

  try {
    res.json(await addToCart(req.user!.sub, parsed.data.productId, parsed.data.quantity));
  } catch (err) {
    if (err instanceof CartError) {
      res.status(400).json({ error: err.message });
      return;
    }
    next(err);
  }
});

cartRouter.delete("/:productId", async (req, res, next) => {
  try {
    res.json(await removeFromCart(req.user!.sub, req.params.productId));
  } catch (err) {
    next(err);
  }
});
