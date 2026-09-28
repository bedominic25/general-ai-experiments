import type { Locator, Page } from "@playwright/test";

export class CheckoutPage {
  readonly confirmation: Locator;
  readonly orderId: Locator;
  readonly orderTotal: Locator;
  readonly continueShoppingLink: Locator;

  constructor(readonly page: Page) {
    this.confirmation = page.getByTestId("checkout-confirmation");
    this.orderId = page.getByTestId("checkout-order-id");
    this.orderTotal = page.getByTestId("checkout-order-total");
    this.continueShoppingLink = page.getByTestId("continue-shopping-link");
  }
}
