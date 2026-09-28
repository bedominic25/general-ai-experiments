import { test, expect } from "../../fixtures/testFixtures.js";

test.describe("Authentication", () => {
  test("a new user can register and lands on the home page logged in", async ({ pom, page }) => {
    const email = `ui-register-${Date.now()}@example.com`;

    await pom.register.goto();
    await pom.register.register("UI Test User", email, "Password123!");

    await expect(page).toHaveURL("/");
    await expect(pom.navbar.userName).toHaveText("UI Test User");
  });

  test("registering with an already-used email shows an error", async ({ pom, registeredUser }) => {
    await pom.register.goto();
    await pom.register.register("Duplicate User", registeredUser.email, "Password123!");

    await expect(pom.register.error).toBeVisible();
  });

  test("logging in with the wrong password shows an error", async ({ pom, registeredUser }) => {
    await pom.login.goto();
    await pom.login.login(registeredUser.email, "the-wrong-password");

    await expect(pom.login.error).toBeVisible();
  });

  test("a logged-in user can log out", async ({ pom, authenticatedPage }) => {
    await expect(pom.navbar.logoutButton).toBeVisible();
    await pom.navbar.logout();
    await expect(pom.navbar.loginLink).toBeVisible();
  });
});
