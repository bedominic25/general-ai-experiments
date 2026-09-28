import { useLocation, useParams, Link } from "react-router-dom";

interface OrderState {
  order?: { id: string; totalCents: number };
}

export function CheckoutPage() {
  const { id } = useParams<{ id: string }>();
  const location = useLocation();
  const order = (location.state as OrderState | null)?.order;

  return (
    <main className="checkout-page" data-testid="checkout-page">
      <h1 data-testid="checkout-confirmation">Order confirmed</h1>
      <p data-testid="checkout-order-id">Order ID: {id}</p>
      {order && <p data-testid="checkout-order-total">Total charged: ${(order.totalCents / 100).toFixed(2)}</p>}
      <Link to="/" data-testid="continue-shopping-link">
        Continue shopping
      </Link>
    </main>
  );
}
