import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { apiRequest } from "../api/restClient";
import { useAuth } from "../context/AuthContext";
import { useCart } from "../context/CartContext";

interface Order {
  id: string;
  totalCents: number;
}

export function CartPage() {
  const { token } = useAuth();
  const { items, totalCents, removeItem, refresh } = useCart();
  const navigate = useNavigate();
  const [checkingOut, setCheckingOut] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleCheckout() {
    setCheckingOut(true);
    setError(null);
    try {
      const order = await apiRequest<Order>("/api/orders", { method: "POST", token });
      await refresh();
      navigate(`/checkout/${order.id}`, { state: { order } });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Checkout failed");
    } finally {
      setCheckingOut(false);
    }
  }

  if (!token) {
    return <p data-testid="cart-login-required">Log in to view your cart.</p>;
  }

  return (
    <main className="cart-page" data-testid="cart-page">
      <h1>Your cart</h1>

      {items.length === 0 ? (
        <p data-testid="cart-empty-message">Your cart is empty.</p>
      ) : (
        <ul className="cart-items" data-testid="cart-items">
          {items.map((item) => (
            <li key={item.productId} data-testid="cart-item">
              <span data-testid="cart-item-name">{item.name}</span>
              <span data-testid="cart-item-quantity"> x{item.quantity}</span>
              <span data-testid="cart-item-price"> ${((item.priceCents * item.quantity) / 100).toFixed(2)}</span>
              <button type="button" data-testid="cart-item-remove" onClick={() => removeItem(item.productId)}>
                Remove
              </button>
            </li>
          ))}
        </ul>
      )}

      <p data-testid="cart-total">Total: ${(totalCents / 100).toFixed(2)}</p>

      {error && (
        <p role="alert" data-testid="checkout-error">
          {error}
        </p>
      )}

      <button
        type="button"
        data-testid="checkout-button"
        disabled={items.length === 0 || checkingOut}
        onClick={handleCheckout}
      >
        {checkingOut ? "Placing order…" : "Proceed to checkout"}
      </button>
    </main>
  );
}
