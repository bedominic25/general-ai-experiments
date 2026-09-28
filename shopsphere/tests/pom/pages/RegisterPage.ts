import type { Locator, Page } from "@playwright/test";
import { WEB_BASE_URL } from "../../env.js";

export class RegisterPage {
  readonly nameInput: Locator;
  readonly emailInput: Locator;
  readonly passwordInput: Locator;
  readonly submitButton: Locator;
  readonly error: Locator;

  constructor(readonly page: Page) {
    this.nameInput = page.getByTestId("register-name-input");
    this.emailInput = page.getByTestId("register-email-input");
    this.passwordInput = page.getByTestId("register-password-input");
    this.submitButton = page.getByTestId("register-submit-button");
    this.error = page.getByTestId("register-error");
  }

  async goto(): Promise<void> {
    await this.page.goto(`${WEB_BASE_URL}/register`);
  }

  async register(name: string, email: string, password: string): Promise<void> {
    await this.nameInput.fill(name);
    await this.emailInput.fill(email);
    await this.passwordInput.fill(password);
    await this.submitButton.click();
  }
}
