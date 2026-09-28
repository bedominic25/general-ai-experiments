import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { apiRequest } from "../api/restClient";
import { useAuth } from "./AuthContext";

export interface CartItem {
  productId: string;
  name: string;
  priceCents: number;
  imageUrl: string;
  quantity: number;
}

interface CartState {
  items: CartItem[];
  totalCents: number;
  loading: boolean;
  addItem(productId: string, quantity?: number): Promise<void>;
  removeItem(productId: string): Promise<void>;
  refresh(): Promise<void>;
}

const CartContext = createContext<CartState | undefined>(undefined);

export function CartProvider({ children }: { children: ReactNode }) {
  const { token } = useAuth();
  const [items, setItems] = useState<CartItem[]>([]);
  const [totalCents, setTotalCents] = useState(0);
  const [loading, setLoading] = useState(false);

  const refresh = useCallback(async () => {
    if (!token) {
      setItems([]);
      setTotalCents(0);
      return;
    }
    setLoading(true);
    try {
      const cart = await apiRequest<{ items: CartItem[]; totalCents: number }>("/api/cart", { token });
      setItems(cart.items);
      setTotalCents(cart.totalCents);
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  async function addItem(productId: string, quantity = 1) {
    if (!token) throw new Error("Must be logged in to add to cart");
    const cart = await apiRequest<{ items: CartItem[]; totalCents: number }>("/api/cart", {
      method: "POST",
      token,
      body: { productId, quantity },
    });
    setItems(cart.items);
    setTotalCents(cart.totalCents);
  }

  async function removeItem(productId: string) {
    if (!token) return;
    const cart = await apiRequest<{ items: CartItem[]; totalCents: number }>(`/api/cart/${productId}`, {
      method: "DELETE",
      token,
    });
    setItems(cart.items);
    setTotalCents(cart.totalCents);
  }

  const value = useMemo(() => ({ items, totalCents, loading, addItem, removeItem, refresh }), [items, totalCents, loading, refresh]);

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart(): CartState {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error("useCart must be used within CartProvider");
  return ctx;
}
