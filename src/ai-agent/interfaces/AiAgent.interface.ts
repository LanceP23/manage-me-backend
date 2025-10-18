export interface AiAgentInterface {
  readonly providerName: string;
  generateResponse(prompt: string): Promise<string>;
  validateApiKey(): boolean;
}
