import { AiTicketDraftDto } from '../dto/ai-ticket-draft.dto';
import { GenerateTicketDraftsDto } from '../dto/generate-ticket-drafts.dto';
import { LinkCommitDto } from '../dto/link-commit.dto';
import { CommitLinkDecisionDto } from '../dto/commit-link-decision.dto';

export interface AiTicketInterface {
  generateTicketDrafts(
    input: GenerateTicketDraftsDto,
    organizationId?: string,
  ): Promise<AiTicketDraftDto[]>;
  classifyCommitLink(
    input: LinkCommitDto,
    organizationId?: string,
  ): Promise<CommitLinkDecisionDto | null>;
}
