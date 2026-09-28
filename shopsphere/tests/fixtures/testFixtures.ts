import { test as base, expect } from "@playwright/test";
import { API_BASE_URL, WEB_BASE_URL } from "../env.js";
import { HomePage } from "../pom/pages/HomePage.js";
import { ProductDetailPage } from "../pom/pages/ProductDetailPage.js";
import { CartPage } from "../pom/pages/CartPage.js";
import { CheckoutPage } from "../pom/pages/CheckoutPage.js";
import { LoginPage } from "../pom/pages/LoginPage.js";
import { RegisterPage } from "../pom/pages/RegisterPage.js";
import { Navbar } from "../pom/components/Navbar.js";
import { AIAssistantWidget } from "../pom/components/AIAssistantWidget.js";

export interface RegisteredUser {
  email: string;
  password: string;
  name: string;
  token: string;
  userId: string;
}

interface Pom {
  home: HomePage;
  productDetail: ProductDetailPage;
  cart: CartPage;
  checkout: CheckoutPage;
  login: LoginPage;
  register: RegisterPage;
  navbar: Navbar;
  aiAssistant: AIAssistantWidget;
}

interface Fixtures {
  pom: Pom;
  registeredUser: RegisteredUser;
  authenticatedPage: import("@playwright/test").Page;
}

export const test = base.extend<Fixtures>({
  pom: async ({ page }, use) => {
    await use({
      home: new HomePage(page),
      productDetail: new ProductDetailPage(page),
      cart: new CartPage(page),
      checkout: new CheckoutPage(page),
      login: new LoginPage(page),
      register: new RegisterPage(page),
      navbar: new Navbar(page),
      aiAssistant: new AIAssistantWidget(page),
    });
  },

  // Provisions a fresh, isolated user via the REST API so UI specs that need
  // an authenticated cart/checkout don't have to repeat the registration
  // flow (that flow gets its own dedicated coverage in specs/web/auth.spec.ts).
  registeredUser: async ({ request }, use, testInfo) => {
    const email = `pw-${testInfo.testId}-${Date.now()}@example.com`;
    const password = "Password123!";
    const name = "Playwright Test User";

    const res = await request.post(`${API_BASE_URL}/api/auth/register`, {
      data: { email, password, name },
    });
    expect(res.ok(), `registration failed: ${await res.text()}`).toBeTruthy();
    const body = (await res.json()) as { token: string; user: { id: string } };

    await use({ email, password, name, token: body.token, userId: body.user.id });
  },

  authenticatedPage: async ({ page, registeredUser }, use) => {
    await page.goto(WEB_BASE_URL);
    await page.evaluate(
      ([token, email, name, userId]) => {
        localStorage.setItem(
          "shopsphere.auth",
          JSON.stringify({ token, user: { id: userId, email, name, role: "customer" } }),
        );
      },
      [registeredUser.token, registeredUser.email, registeredUser.name, registeredUser.userId],
    );
    await page.reload();
    await use(page);
  },
});

export { expect };
