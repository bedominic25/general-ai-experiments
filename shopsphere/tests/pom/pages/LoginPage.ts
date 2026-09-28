import type { Locator, Page } from "@playwright/test";
import { WEB_BASE_URL } from "../../env.js";

export class LoginPage {
  readonly emailInput: Locator;
  readonly passwordInput: Locator;
  readonly submitButton: Locator;
  readonly error: Locator;

  constructor(readonly page: Page) {
    this.emailInput = page.getByTestId("login-email-input");
    this.passwordInput = page.getByTestId("login-password-input");
    this.submitButton = page.getByTestId("login-submit-button");
    this.error = page.getByTestId("login-error");
  }

  async goto(): Promise<void> {
    await this.page.goto(`${WEB_BASE_URL}/login`);
  }

  async login(email: string, password: string): Promise<void> {
    await this.emailInput.fill(email);
    await this.passwordInput.fill(password);
    await this.submitButton.click();
  }
}
