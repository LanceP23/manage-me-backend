export interface AiAgentInterface {
  readonly providerName: string;
  context: string;
  generateResponse(prompt: string): Promise<string>;
  validateApiKey(): boolean;
}
