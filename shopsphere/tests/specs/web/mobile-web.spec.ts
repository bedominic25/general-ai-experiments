import { test, expect } from "../../fixtures/testFixtures.js";

// Runs only under the "mobile-web" Playwright project (iPhone 14 emulation -
// see playwright.config.ts). Everything else in specs/web already runs
// against both desktop-chrome and mobile-web; this file adds assertions
// that only make sense on a real mobile viewport.
test.describe("Mobile-web viewport", () => {
  test.beforeEach(async ({}, testInfo) => {
    test.skip(testInfo.project.name !== "mobile-web", "mobile-only checks");
  });

  test("the storefront has no horizontal overflow at mobile width", async ({ pom, page }) => {
    await pom.home.goto();

    const { scrollWidth, clientWidth } = await page.evaluate(() => ({
      scrollWidth: document.documentElement.scrollWidth,
      clientWidth: document.documentElement.clientWidth,
    }));
    expect(scrollWidth).toBeLessThanOrEqual(clientWidth + 1);
  });

  test("the AI assistant panel fits within the mobile viewport", async ({ pom, page }) => {
    await pom.home.goto();
    await pom.aiAssistant.open();

    const box = await pom.aiAssistant.panel.boundingBox();
    expect(box).not.toBeNull();
    expect(box!.width).toBeLessThanOrEqual(page.viewportSize()!.width);
  });

  test("product grid and add-to-cart remain usable on a touch viewport", async ({ pom, authenticatedPage }) => {
    await pom.home.goto();
    await pom.home.addToCartByName("CoreFlex Yoga Mat");
    await expect(pom.home.homeMessage).toHaveText("Added to cart.");
  });
});
