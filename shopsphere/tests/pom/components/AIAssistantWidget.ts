import { expect, type Locator, type Page } from "@playwright/test";

export class AIAssistantWidget {
  readonly toggleButton: Locator;
  readonly panel: Locator;
  readonly input: Locator;
  readonly sendButton: Locator;
  readonly assistantTurns: Locator;
  readonly userTurns: Locator;
  readonly recommendedProducts: Locator;
  readonly errorMessage: Locator;

  constructor(readonly page: Page) {
    this.toggleButton = page.getByTestId("ai-assistant-toggle");
    this.panel = page.getByTestId("ai-assistant-panel");
    this.input = page.getByTestId("ai-assistant-input");
    this.sendButton = page.getByTestId("ai-assistant-send");
    this.assistantTurns = page.getByTestId("ai-turn-assistant");
    this.userTurns = page.getByTestId("ai-turn-user");
    this.recommendedProducts = page.getByTestId("ai-recommended-product");
    this.errorMessage = page.getByTestId("ai-assistant-error");
  }

  async open(): Promise<void> {
    if (!(await this.panel.isVisible())) {
      await this.toggleButton.click();
    }
  }

  async ask(message: string): Promise<void> {
    await this.open();
    const turnsBefore = await this.assistantTurns.count();
    await this.input.fill(message);
    await this.sendButton.click();
    await expect(this.assistantTurns).toHaveCount(turnsBefore + 1);
  }

  async latestReply(): Promise<string> {
    return (await this.assistantTurns.last().textContent()) ?? "";
  }
}
