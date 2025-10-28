export const GENERATE_QUESTIONS_PROMPTS = {
  PROMPT_1: `
Give me 10 questions that, if answered, will give you the needed context to generate project management tickets with just a short description of a bug or a feature.
Return the result as a valid JSON array with the following structure:

[
  {
    "id": 1,
    "question": "string"
  }
]

Only return JSON — no extra text.
`,
  PROMPT_2: 'Enter another prompt here',
};
