export const PRODUCT_CONTEXT_QUESTIONS_PROMPT_V1 = {
  version: 'v1',
  prompt:
    'Give me 10 questions that, if answered, will give you the needed context to generate project management tickets with just a short description of a bug or a feature.',
};

export const IMAGE_TICKET_DRAFTS_PROMPT_V1 = {
  version: 'v1',
  build: (contextText?: string) =>
    [
      `Prompt Version: v1`,
      'You are an expert project manager and ticket creator.',
      'Analyze the provided image and create detailed tickets based on the visual content.',
      '',
      contextText ? `Product Context Information:\n${contextText}` : '',
      'Based on the image content and available context, create tickets in the following JSON format:',
      '',
      '[',
      '  {',
      '    "title": "Clear, concise ticket title",',
      '    "description": "Detailed description including context, requirements, and acceptance criteria",',
      '    "status": "todo",',
      '    "priority": "low|medium|high|urgent"',
      '  }',
      ']',
      '',
      'Guidelines for ticket creation:',
      '- Create actionable, well-defined tickets',
      '- Include enough context for a developer to understand and implement',
      '- Use appropriate priority levels',
      '- Each ticket should represent a single, manageable unit of work',
      '- Focus on bugs, features, improvements, or tasks identified in the image',
      '',
      'Return ONLY valid JSON - no extra text, no markdown formatting.',
    ]
      .filter(Boolean)
      .join('\n'),
};
