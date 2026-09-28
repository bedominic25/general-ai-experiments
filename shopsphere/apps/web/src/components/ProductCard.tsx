import { Link } from "react-router-dom";

export interface ProductSummary {
  id: string;
  name: string;
  description: string;
  category: string;
  priceCents: number;
  stock: number;
  imageUrl: string;
}

export function ProductCard({ product, onAddToCart }: { product: ProductSummary; onAddToCart?: (id: string) => void }) {
  return (
    <article className="product-card" data-testid="product-card" data-product-id={product.id}>
      <Link to={`/products/${product.id}`} data-testid="product-card-link">
        <div className="product-card-image-placeholder" aria-hidden="true">
          {product.category}
        </div>
        <h3 data-testid="product-card-name">{product.name}</h3>
      </Link>
      <p className="product-card-price" data-testid="product-card-price">
        ${(product.priceCents / 100).toFixed(2)}
      </p>
      {onAddToCart && (
        <button
          type="button"
          data-testid="add-to-cart-button"
          disabled={product.stock === 0}
          onClick={() => onAddToCart(product.id)}
        >
          {product.stock === 0 ? "Out of stock" : "Add to cart"}
        </button>
      )}
    </article>
  );
}
