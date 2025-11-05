export interface AiAgentInterface {
  readonly providerName: string;
  context: string;
  generateResponse(prompt: string): Promise<string>;
  generateResponseWithImage(prompt: string, imagePath: string): Promise<string>;
  validateApiKey(): boolean;
}
