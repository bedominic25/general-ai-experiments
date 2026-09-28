import { Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { useCart } from "../context/CartContext";

export function Navbar() {
  const { user, logout } = useAuth();
  const { items } = useCart();
  const itemCount = items.reduce((sum, i) => sum + i.quantity, 0);

  return (
    <header className="navbar" data-testid="navbar">
      <Link to="/" className="navbar-brand" data-testid="nav-home-link">
        ShopSphere
      </Link>

      <nav className="navbar-links">
        <Link to="/cart" data-testid="nav-cart-link">
          Cart{itemCount > 0 ? ` (${itemCount})` : ""}
        </Link>

        {user ? (
          <>
            <span data-testid="nav-user-name">{user.name}</span>
            <button type="button" data-testid="nav-logout-button" onClick={logout}>
              Log out
            </button>
          </>
        ) : (
          <>
            <Link to="/login" data-testid="nav-login-link">
              Log in
            </Link>
            <Link to="/register" data-testid="nav-register-link">
              Register
            </Link>
          </>
        )}
      </nav>
    </header>
  );
}
