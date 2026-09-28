import type { Locator, Page } from "@playwright/test";
import { WEB_BASE_URL } from "../../env.js";

export class HomePage {
  readonly searchInput: Locator;
  readonly categorySelect: Locator;
  readonly productGrid: Locator;
  readonly productCards: Locator;
  readonly noProductsMessage: Locator;
  readonly homeMessage: Locator;

  constructor(readonly page: Page) {
    this.searchInput = page.getByTestId("search-input");
    this.categorySelect = page.getByTestId("category-select");
    this.productGrid = page.getByTestId("product-grid");
    this.productCards = page.getByTestId("product-card");
    this.noProductsMessage = page.getByTestId("no-products-message");
    this.homeMessage = page.getByTestId("home-message");
  }

  async goto(): Promise<void> {
    await this.page.goto(WEB_BASE_URL);
  }

  async search(query: string): Promise<void> {
    // Filtered on postData (not just "/graphql"), otherwise this can resolve
    // on a still-in-flight *initial* products query instead of the one the
    // search actually triggers, and we'd assert against stale/loading state.
    const responsePromise = this.waitForProductsResponse(query);
    await this.searchInput.fill(query);
    await responsePromise;
  }

  async filterByCategory(category: string): Promise<void> {
    const responsePromise = this.waitForProductsResponse(category);
    await this.categorySelect.selectOption(category);
    await responsePromise;
  }

  private waitForProductsResponse(variableValue: string) {
    return this.page.waitForResponse(
      (r) => r.url().includes("/graphql") && (r.request().postData() ?? "").includes(variableValue),
    );
  }

  productCardByName(name: string): Locator {
    return this.productCards.filter({ hasText: name });
  }

  async addToCartByName(name: string): Promise<void> {
    await this.productCardByName(name).getByTestId("add-to-cart-button").click();
  }

  async openProductByName(name: string): Promise<void> {
    await this.productCardByName(name).getByTestId("product-card-link").click();
  }
}
