import type { Locator, Page } from "@playwright/test";
import { WEB_BASE_URL } from "../../env.js";

export class CartPage {
  readonly items: Locator;
  readonly total: Locator;
  readonly checkoutButton: Locator;
  readonly emptyMessage: Locator;
  readonly checkoutError: Locator;

  constructor(readonly page: Page) {
    this.items = page.getByTestId("cart-item");
    this.total = page.getByTestId("cart-total");
    this.checkoutButton = page.getByTestId("checkout-button");
    this.emptyMessage = page.getByTestId("cart-empty-message");
    this.checkoutError = page.getByTestId("checkout-error");
  }

  async goto(): Promise<void> {
    await this.page.goto(`${WEB_BASE_URL}/cart`);
  }

  itemByName(name: string): Locator {
    return this.items.filter({ hasText: name });
  }

  async removeItemByName(name: string): Promise<void> {
    await this.itemByName(name).getByTestId("cart-item-remove").click();
  }

  async checkout(): Promise<void> {
    await this.checkoutButton.click();
  }
}
