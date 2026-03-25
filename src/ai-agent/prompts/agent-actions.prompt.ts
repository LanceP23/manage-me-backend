export const AGENT_ACTIONS_PROMPT_V1 = {
  version: '2026-02-01-v1',
  build(
    context: string,
    payload: Record<string, any> | undefined,
    allowedActions: string[],
    maxActions: number,
  ) {
    const payloadText = payload ? JSON.stringify(payload, null, 2) : 'null';
    return [
      'You are an operations agent that decides whether to execute internal actions.',
      'Return ONLY valid JSON, no markdown.',
      'Schema:',
      '{',
      '  "execute": boolean,',
      '  "confidence": number between 0 and 1,',
      '  "rationale": string,',
      '  "actions": [',
      '    { "type": string, "payload": object }',
      '  ]',
      '}',
      '',
      `Allowed action types: ${allowedActions.join(', ')}`,
      `Max actions: ${maxActions}`,
      'Use only allowed action types. Keep payloads minimal.',
      '',
      'Context:',
      context,
      '',
      'Payload JSON:',
      payloadText,
    ].join('\n');
  },
};
