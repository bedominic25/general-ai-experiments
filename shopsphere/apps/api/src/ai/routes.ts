import { Router } from "express";
import { z } from "zod";
import { optionalAuth } from "../auth/middleware.js";
import { chatWithAssistant, getChatHistory, retrieveProducts } from "./assistant.js";

export const aiRouter = Router();

const chatSchema = z.object({
  sessionId: z.string().min(1),
  message: z.string().min(1).max(2000),
});

aiRouter.post("/chat", optionalAuth, async (req, res, next) => {
  const parsed = chatSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.flatten() });
    return;
  }

  try {
    const result = await chatWithAssistant(parsed.data.sessionId, req.user?.sub, parsed.data.message);
    res.json(result);
  } catch (err) {
    next(err);
  }
});

aiRouter.get("/chat/:sessionId", async (req, res, next) => {
  try {
    res.json(await getChatHistory(req.params.sessionId));
  } catch (err) {
    next(err);
  }
});

// Exposes the raw retrieval step (no LLM call): fast, deterministic, and used
// directly by the retrieval regression tests in tests/specs/retrieval.
aiRouter.get("/retrieve", async (req, res, next) => {
  const q = req.query.q;
  if (typeof q !== "string" || q.length === 0) {
    res.status(400).json({ error: "Missing query parameter 'q'" });
    return;
  }

  try {
    res.json({ matches: await retrieveProducts(q) });
  } catch (err) {
    next(err);
  }
});
