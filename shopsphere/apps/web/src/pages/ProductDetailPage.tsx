import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { apiRequest } from "../api/restClient";
import { useAuth } from "../context/AuthContext";
import { useCart } from "../context/CartContext";
import type { ProductSummary } from "../components/ProductCard";

export function ProductDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { token } = useAuth();
  const { addItem } = useCart();
  const [product, setProduct] = useState<ProductSummary | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    apiRequest<ProductSummary>(`/api/products/${id}`).then(setProduct);
  }, [id]);

  if (!product) {
    return <p data-testid="product-detail-loading">Loading product…</p>;
  }

  async function handleAddToCart() {
    if (!token) {
      setMessage("Log in to add items to your cart.");
      return;
    }
    await addItem(product!.id, 1);
    setMessage("Added to cart.");
  }

  return (
    <main className="product-detail-page" data-testid="product-detail-page">
      <h1 data-testid="product-detail-name">{product.name}</h1>
      <p data-testid="product-detail-description">{product.description}</p>
      <p data-testid="product-detail-price">${(product.priceCents / 100).toFixed(2)}</p>
      <p data-testid="product-detail-stock">{product.stock > 0 ? `${product.stock} in stock` : "Out of stock"}</p>
      <button type="button" data-testid="add-to-cart-button" disabled={product.stock === 0} onClick={handleAddToCart}>
        Add to cart
      </button>
      {message && (
        <p data-testid="product-detail-message" role="status">
          {message}
        </p>
      )}
    </main>
  );
}
