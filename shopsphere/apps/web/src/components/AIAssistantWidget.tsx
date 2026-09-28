import { useState } from "react";
import { apiRequest } from "../api/restClient";
import { useAuth } from "../context/AuthContext";
import type { ProductSummary } from "./ProductCard";

interface ChatTurn {
  role: "user" | "assistant";
  content: string;
  products?: ProductSummary[];
}

interface ChatResponse {
  reply: string;
  provider: string;
  latencyMs: number;
  retrievedProducts: ProductSummary[];
}

function getSessionId(): string {
  const key = "shopsphere.ai-session";
  let sessionId = sessionStorage.getItem(key);
  if (!sessionId) {
    sessionId = crypto.randomUUID();
    sessionStorage.setItem(key, sessionId);
  }
  return sessionId;
}

export function AIAssistantWidget() {
  const { token } = useAuth();
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState("");
  const [turns, setTurns] = useState<ChatTurn[]>([]);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function send() {
    const message = input.trim();
    if (!message || sending) return;

    setSending(true);
    setError(null);
    setTurns((prev) => [...prev, { role: "user", content: message }]);
    setInput("");

    try {
      const result = await apiRequest<ChatResponse>("/api/ai/chat", {
        method: "POST",
        token,
        body: { sessionId: getSessionId(), message },
      });
      setTurns((prev) => [...prev, { role: "assistant", content: result.reply, products: result.retrievedProducts }]);
    } catch {
      setError("The shopping assistant is unavailable right now. Please try again.");
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="ai-assistant-widget" data-testid="ai-assistant-widget">
      <button
        type="button"
        data-testid="ai-assistant-toggle"
        className="ai-assistant-toggle"
        onClick={() => setOpen((v) => !v)}
      >
        {open ? "Close assistant" : "Ask the shopping assistant"}
      </button>

      {open && (
        <div className="ai-assistant-panel" data-testid="ai-assistant-panel">
          <div className="ai-assistant-messages" data-testid="ai-assistant-messages">
            {turns.length === 0 && (
              <p className="ai-assistant-empty">
                Try: &ldquo;I need something warm for winter trail running&rdquo;
              </p>
            )}
            {turns.map((turn, i) => (
              <div key={i} className={`ai-turn ai-turn-${turn.role}`} data-testid={`ai-turn-${turn.role}`}>
                <p>{turn.content}</p>
                {turn.products && turn.products.length > 0 && (
                  <ul className="ai-turn-products" data-testid="ai-recommended-products">
                    {turn.products.map((p) => (
                      <li key={p.id} data-testid="ai-recommended-product">
                        {p.name} - ${(p.priceCents / 100).toFixed(2)}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            ))}
            {sending && <p data-testid="ai-assistant-loading">Thinking…</p>}
            {error && (
              <p role="alert" data-testid="ai-assistant-error">
                {error}
              </p>
            )}
          </div>

          <form
            className="ai-assistant-input-row"
            onSubmit={(e) => {
              e.preventDefault();
              send();
            }}
          >
            <input
              data-testid="ai-assistant-input"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ask about a product..."
              aria-label="Ask the shopping assistant"
            />
            <button type="submit" data-testid="ai-assistant-send" disabled={sending}>
              Send
            </button>
          </form>
        </div>
      )}
    </div>
  );
}
