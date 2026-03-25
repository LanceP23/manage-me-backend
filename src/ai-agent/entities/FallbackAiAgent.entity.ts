import { AiAgentInterface } from '../interfaces/AiAgent.interface';

export class FallbackAiAgent implements AiAgentInterface {
  readonly providerName: string;
  private _context: string = 'No Context Built Yet';

  constructor(
    private readonly primary: AiAgentInterface,
    private readonly fallback: AiAgentInterface,
  ) {
    this.providerName = primary.providerName;
  }

  get context(): string {
    return this._context;
  }

  set context(value: string) {
    this._context = value;
    this.primary.context = value;
    this.fallback.context = value;
  }

  async generateResponse(prompt: string): Promise<string> {
    if (this.primary.validateApiKey()) {
      try {
        return await this.primary.generateResponse(prompt);
      } catch (error) {
        // fall through to fallback
      }
    }

    if (!this.fallback.validateApiKey()) {
      throw new Error('No valid API key for fallback provider');
    }

    return this.fallback.generateResponse(prompt);
  }

  async generateResponseWithImage(
    prompt: string,
    imagePath: string,
  ): Promise<string> {
    if (this.primary.validateApiKey()) {
      try {
        return await this.primary.generateResponseWithImage(prompt, imagePath);
      } catch (error) {
        // fall through to fallback
      }
    }

    if (!this.fallback.validateApiKey()) {
      throw new Error('No valid API key for fallback provider');
    }

    return this.fallback.generateResponseWithImage(prompt, imagePath);
  }

  validateApiKey(): boolean {
    return this.primary.validateApiKey() || this.fallback.validateApiKey();
  }
}
