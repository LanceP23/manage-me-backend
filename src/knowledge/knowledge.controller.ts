import { Body, Controller, Headers, Post, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { OrgGuard } from '../organization/guards/org.guard';
import { BackfillKnowledgeDto } from './dto/backfill-knowledge.dto';
import { RetrieveKnowledgeDto } from './dto/retrieve-knowledge.dto';
import { KnowledgeService } from './knowledge.service';

@Controller('knowledge')
@UseGuards(JwtAuthGuard, OrgGuard)
export class KnowledgeController {
  constructor(private readonly knowledgeService: KnowledgeService) {}

  @Post('backfill')
  async backfill(
    @Body() body: BackfillKnowledgeDto,
    @Headers('x-org-id') organizationId: string,
  ) {
    const result = await this.knowledgeService.backfillOrganizationKnowledge(
      organizationId,
      body.productId,
    );

    return {
      message: 'Knowledge backfill completed',
      ...result,
    };
  }

  @Post('retrieve')
  async retrieve(
    @Body() body: RetrieveKnowledgeDto,
    @Headers('x-org-id') organizationId: string,
  ) {
    return this.knowledgeService.retrieve(organizationId, body);
  }
}
