import { Router } from "express";
import { getProductById, listCategories, listProducts } from "./service.js";

export const productsRouter = Router();

productsRouter.get("/", async (req, res, next) => {
  try {
    const { q, category, page, pageSize } = req.query;
    const result = await listProducts({
      search: typeof q === "string" ? q : undefined,
      category: typeof category === "string" ? category : undefined,
      page: page ? Number(page) : undefined,
      pageSize: pageSize ? Number(pageSize) : undefined,
    });
    res.json(result);
  } catch (err) {
    next(err);
  }
});

productsRouter.get("/categories", async (_req, res, next) => {
  try {
    res.json({ categories: await listCategories() });
  } catch (err) {
    next(err);
  }
});

productsRouter.get("/:id", async (req, res, next) => {
  try {
    const product = await getProductById(req.params.id);
    if (!product) {
      res.status(404).json({ error: "Product not found" });
      return;
    }
    res.json(product);
  } catch (err) {
    next(err);
  }
});
