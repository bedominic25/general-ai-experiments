import { test, expect } from "../../fixtures/testFixtures.js";

test.describe("Home page catalog browsing", () => {
  test.beforeEach(async ({ pom }) => {
    await pom.home.goto();
  });

  test("lists products on load", async ({ pom }) => {
    await expect(pom.home.productCards.first()).toBeVisible();
    expect(await pom.home.productCards.count()).toBeGreaterThan(0);
  });

  test("search narrows the catalog to matching products", async ({ pom }) => {
    await pom.home.search("winter");

    const count = await pom.home.productCards.count();
    expect(count).toBeGreaterThan(0);
    await expect(pom.home.productCardByName("TrailBlazer Winter Running Shoes")).toBeVisible();
    await expect(pom.home.productCardByName("BrewPeak Pour-Over Coffee Set")).toHaveCount(0);
  });

  test("an unmatched search shows the empty state", async ({ pom }) => {
    await pom.home.search("zzz-nonexistent-product-zzz");
    await expect(pom.home.noProductsMessage).toBeVisible();
  });

  test("category filter narrows results to that category", async ({ pom }) => {
    await pom.home.filterByCategory("footwear");

    const count = await pom.home.productCards.count();
    expect(count).toBeGreaterThan(0);
    await expect(pom.home.productCardByName("SummitGrip Hiking Boots")).toBeVisible();
  });
});
