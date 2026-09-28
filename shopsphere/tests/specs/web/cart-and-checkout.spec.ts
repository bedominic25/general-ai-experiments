import { test, expect } from "../../fixtures/testFixtures.js";

test.describe("Cart and checkout", () => {
  test("an unauthenticated visitor is prompted to log in to view the cart", async ({ pom }) => {
    await pom.cart.goto();
    await expect(pom.cart.page.getByTestId("cart-login-required")).toBeVisible();
  });

  test("adding a product from the catalog updates the cart badge and contents", async ({
    pom,
    authenticatedPage,
  }) => {
    await pom.home.goto();
    await pom.home.addToCartByName("CoreFlex Yoga Mat");
    await expect(pom.home.homeMessage).toHaveText("Added to cart.");

    await pom.navbar.goToCart();
    await expect(pom.cart.itemByName("CoreFlex Yoga Mat")).toBeVisible();
  });

  test("removing an item empties the cart", async ({ pom, authenticatedPage }) => {
    await pom.home.goto();
    await pom.home.addToCartByName("CoreFlex Yoga Mat");

    await pom.cart.goto();
    await pom.cart.removeItemByName("CoreFlex Yoga Mat");

    await expect(pom.cart.emptyMessage).toBeVisible();
  });

  test("checking out places an order and shows a confirmation", async ({ pom, authenticatedPage }) => {
    await pom.home.goto();
    await pom.home.addToCartByName("BrewPeak Pour-Over Coffee Set");

    await pom.cart.goto();
    await pom.cart.checkout();

    await expect(pom.checkout.confirmation).toBeVisible();
    await expect(pom.checkout.orderTotal).toHaveText("Total charged: $42.99");

    // Cart is cleared server-side on checkout.
    await pom.cart.goto();
    await expect(pom.cart.emptyMessage).toBeVisible();
  });

  test("adding a product from its detail page works the same as from the grid", async ({
    pom,
    authenticatedPage,
  }) => {
    await pom.home.goto();
    await pom.home.openProductByName("QuietHum Air Purifier");

    await expect(pom.productDetail.name).toHaveText("QuietHum Air Purifier");
    await pom.productDetail.addToCart();
    await expect(pom.productDetail.message).toHaveText("Added to cart.");

    await pom.cart.goto();
    await expect(pom.cart.itemByName("QuietHum Air Purifier")).toBeVisible();
  });
});
