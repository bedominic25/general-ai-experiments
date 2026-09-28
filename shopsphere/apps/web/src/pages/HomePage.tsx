import { useEffect, useState } from "react";
import { graphqlRequest } from "../api/graphqlClient";
import { ProductCard, type ProductSummary } from "../components/ProductCard";
import { useCart } from "../context/CartContext";
import { useAuth } from "../context/AuthContext";

const PRODUCTS_QUERY = `
  query Products($search: String, $category: String) {
    products(search: $search, category: $category) {
      items { id name description category priceCents stock imageUrl }
      total
    }
    categories
  }
`;

interface ProductsQueryResult {
  products: { items: ProductSummary[]; total: number };
  categories: string[];
}

export function HomePage() {
  const { token } = useAuth();
  const { addItem } = useCart();
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("");
  const [products, setProducts] = useState<ProductSummary[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    graphqlRequest<ProductsQueryResult>(PRODUCTS_QUERY, {
      search: search || undefined,
      category: category || undefined,
    })
      .then((data) => {
        if (cancelled) return;
        setProducts(data.products.items);
        setCategories(data.categories);
      })
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [search, category]);

  async function handleAddToCart(productId: string) {
    if (!token) {
      setMessage("Log in to add items to your cart.");
      return;
    }
    await addItem(productId, 1);
    setMessage("Added to cart.");
  }

  return (
    <main className="home-page" data-testid="home-page">
      <h1>Shop the ShopSphere catalog</h1>

      <div className="home-filters">
        <input
          data-testid="search-input"
          placeholder="Search products..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <select data-testid="category-select" value={category} onChange={(e) => setCategory(e.target.value)}>
          <option value="">All categories</option>
          {categories.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
      </div>

      {message && (
        <p data-testid="home-message" role="status">
          {message}
        </p>
      )}

      {loading ? (
        <p data-testid="products-loading">Loading products…</p>
      ) : (
        <div className="product-grid" data-testid="product-grid">
          {products.map((p) => (
            <ProductCard key={p.id} product={p} onAddToCart={handleAddToCart} />
          ))}
          {products.length === 0 && <p data-testid="no-products-message">No products matched your search.</p>}
        </div>
      )}
    </main>
  );
}
