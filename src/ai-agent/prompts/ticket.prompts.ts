import { GenerateTicketDraftsDto } from 'src/ticket/dto/generate-ticket-drafts.dto';
import { LinkCommitDto } from 'src/ticket/dto/link-commit.dto';

export const TICKET_DRAFTS_PROMPT_V1 = {
  version: 'v1',
  build: (
    input: GenerateTicketDraftsDto,
    maxDrafts: number,
    errorHint: string | null,
  ) =>
    [
      `Prompt Version: v1`,
      'You are an expert project manager and ticket creator.',
      'Create actionable ticket drafts from the input below.',
      '',
      `Source: ${input.source}`,
      input.context ? `Context: ${input.context}` : '',
      `Input: ${input.rawInput}`,
      '',
      `Return ONLY valid JSON (no markdown).`,
      `Create up to ${maxDrafts} items in this exact format:`,
      '[',
      '  {',
      '    "title": "Clear, concise ticket title",',
      '    "description": "Detailed description with requirements and acceptance criteria",',
      '    "status": "todo|in_progress|done|cancelled",',
      '    "priority": "low|medium|high|urgent",',
      '    "confidence": 0.0',
      '  }',
      ']',
      '',
      'Rules:',
      '- All fields must be strings except confidence (number between 0 and 1).',
      '- Do not add extra keys.',
      '- Use double quotes for all JSON keys/values.',
      errorHint ? `Fix this issue from last attempt: ${errorHint}` : '',
    ]
      .filter(Boolean)
      .join('\n'),
};

export const COMMIT_LINK_PROMPT_V1 = {
  version: 'v1',
  build: (
    input: LinkCommitDto,
    candidateText: string,
    errorHint: string | null,
  ) =>
    [
      `Prompt Version: v1`,
      'You are an expert project manager.',
      'Given a git commit and a list of candidate tickets, decide the best matching ticket.',
      'If none match, return ticketId as null.',
      '',
      `Commit SHA: ${input.commitSha}`,
      `Commit message: ${input.commitMessage}`,
      input.repoUrl ? `Repo: ${input.repoUrl}` : '',
      input.diffSummary ? `Diff summary: ${input.diffSummary}` : '',
      '',
      'Candidate tickets:',
      candidateText,
      '',
      'Return ONLY valid JSON (no markdown).',
      'Format:',
      '{',
      '  "ticketId": 123 | null,',
      '  "confidence": 0.0,',
      '  "rationale": "short reason"',
      '}',
      '',
      'Rules:',
      '- ticketId must be one of the candidate ids or null.',
      '- confidence must be between 0 and 1.',
      errorHint ? `Fix this issue from last attempt: ${errorHint}` : '',
    ]
      .filter(Boolean)
      .join('\n'),
};
