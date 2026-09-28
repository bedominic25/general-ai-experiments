import type { Locator, Page } from "@playwright/test";

export class ProductDetailPage {
  readonly name: Locator;
  readonly description: Locator;
  readonly price: Locator;
  readonly stock: Locator;
  readonly addToCartButton: Locator;
  readonly message: Locator;

  constructor(readonly page: Page) {
    this.name = page.getByTestId("product-detail-name");
    this.description = page.getByTestId("product-detail-description");
    this.price = page.getByTestId("product-detail-price");
    this.stock = page.getByTestId("product-detail-stock");
    this.addToCartButton = page.getByTestId("add-to-cart-button");
    this.message = page.getByTestId("product-detail-message");
  }

  async addToCart(): Promise<void> {
    await this.addToCartButton.click();
  }
}
