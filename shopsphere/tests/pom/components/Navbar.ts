import type { Locator, Page } from "@playwright/test";

export class Navbar {
  readonly homeLink: Locator;
  readonly cartLink: Locator;
  readonly loginLink: Locator;
  readonly registerLink: Locator;
  readonly logoutButton: Locator;
  readonly userName: Locator;

  constructor(readonly page: Page) {
    this.homeLink = page.getByTestId("nav-home-link");
    this.cartLink = page.getByTestId("nav-cart-link");
    this.loginLink = page.getByTestId("nav-login-link");
    this.registerLink = page.getByTestId("nav-register-link");
    this.logoutButton = page.getByTestId("nav-logout-button");
    this.userName = page.getByTestId("nav-user-name");
  }

  async goToCart(): Promise<void> {
    await this.cartLink.click();
  }

  async logout(): Promise<void> {
    await this.logoutButton.click();
  }
}
