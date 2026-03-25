import { Body, Controller, Get, Headers, Param, Patch, Post, Req, UseGuards } from '@nestjs/common';
import type { Request } from 'express';
import { IntegrationsService } from './integrations.service';
import { MattermostInboundDto } from './dto/mattermost-inbound.dto';
import { MattermostOutboundDto } from './dto/mattermost-outbound.dto';
import { SlackInboundDto } from './dto/slack-inbound.dto';
import { SlackOutboundDto } from './dto/slack-outbound.dto';
import { OpenProjectOutboundDto } from './dto/openproject-outbound.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { OrgGuard } from '../organization/guards/org.guard';
import { AdminGuard } from '../auth/guards/admin.guard';
import { CreateGithubIntegrationDto, UpdateGithubIntegrationDto } from './dto/github-integration.dto';

@Controller('integrations')
export class IntegrationsController {
  constructor(private readonly integrationsService: IntegrationsService) {}

  @Post('mattermost/inbound')
  handleMattermostInbound(
    @Body() payload: MattermostInboundDto,
    @Headers('x-org-id') orgId?: string,
  ) {
    return this.integrationsService.handleMattermostInbound(payload, orgId);
  }

  @Post('mattermost/outbound')
  handleMattermostOutbound(
    @Body() payload: MattermostOutboundDto,
    @Headers('x-integration-token') token?: string,
    @Headers('x-org-id') orgId?: string,
  ) {
    return this.integrationsService.handleMattermostOutbound(payload, token, orgId);
  }

  @Post('slack/inbound')
  handleSlackInbound(
    @Body() payload: SlackInboundDto,
    @Req() req: Request,
    @Headers('x-slack-signature') signature?: string,
    @Headers('x-slack-request-timestamp') timestamp?: string,
    @Headers('x-org-id') orgId?: string,
  ) {
    const rawBody = (req as any).rawBody || null;
    return this.integrationsService.handleSlackInbound(
      payload,
      rawBody,
      signature,
      timestamp,
      orgId,
    );
  }

  @Post('slack/outbound')
  handleSlackOutbound(
    @Body() payload: SlackOutboundDto,
    @Headers('x-integration-token') token?: string,
    @Headers('x-org-id') orgId?: string,
  ) {
    return this.integrationsService.handleSlackOutbound(payload, token, orgId);
  }

  @Post('openproject/work-packages')
  handleOpenProjectOutbound(
    @Body() payload: OpenProjectOutboundDto,
    @Headers('x-integration-token') token?: string,
    @Headers('x-org-id') orgId?: string,
  ) {
    return this.integrationsService.handleOpenProjectOutbound(payload, token, orgId);
  }

  @Post('openproject/inbound')
  handleOpenProjectInbound(
    @Body() payload: Record<string, any>,
    @Headers('x-openproject-token') token?: string,
    @Headers('x-org-id') orgId?: string,
  ) {
    return this.integrationsService.handleOpenProjectInbound(payload, token, orgId);
  }

  @Post('github/inbound')
  handleGithubInbound(
    @Body() payload: Record<string, any>,
    @Req() req: Request,
    @Headers('x-hub-signature-256') signature?: string,
    @Headers('x-github-event') eventType?: string,
    @Headers('x-org-id') orgId?: string,
  ) {
    const rawBody = (req as any).rawBody || null;
    return this.integrationsService.handleGithubInbound(
      payload,
      rawBody,
      signature,
      eventType,
      orgId,
    );
  }

  @Post('gitlab/inbound')
  handleGitlabInbound(
    @Body() payload: Record<string, any>,
    @Req() req: Request,
    @Headers('x-gitlab-token') token?: string,
    @Headers('x-gitlab-event') eventType?: string,
    @Headers('x-org-id') orgId?: string,
  ) {
    const rawBody = (req as any).rawBody || null;
    return this.integrationsService.handleGitlabInbound(
      payload,
      rawBody,
      token,
      eventType,
      orgId,
    );
  }

  @Post('bitbucket/inbound')
  handleBitbucketInbound(
    @Body() payload: Record<string, any>,
    @Req() req: Request,
    @Headers('x-hub-signature') signature?: string,
    @Headers('x-event-key') eventType?: string,
    @Headers('x-org-id') orgId?: string,
  ) {
    const rawBody = (req as any).rawBody || null;
    return this.integrationsService.handleBitbucketInbound(
      payload,
      rawBody,
      signature,
      eventType,
      orgId,
    );
  }

  @Post('github/config')
  @UseGuards(JwtAuthGuard, OrgGuard, AdminGuard)
  createGithubConfig(
    @Body() payload: CreateGithubIntegrationDto,
    @Headers('x-org-id') orgId?: string,
  ) {
    return this.integrationsService.createGithubIntegrationConfig(payload, orgId);
  }

  @Patch('github/config/:id')
  @UseGuards(JwtAuthGuard, OrgGuard, AdminGuard)
  updateGithubConfig(
    @Param('id') id: string,
    @Body() payload: UpdateGithubIntegrationDto,
    @Headers('x-org-id') orgId?: string,
  ) {
    return this.integrationsService.updateGithubIntegrationConfig(
      Number(id),
      payload,
      orgId,
    );
  }

  @Get('github/config')
  @UseGuards(JwtAuthGuard, OrgGuard, AdminGuard)
  listGithubConfig(@Headers('x-org-id') orgId?: string) {
    return this.integrationsService.listGithubIntegrationConfigs(orgId);
  }

  @Get('status')
  @UseGuards(JwtAuthGuard, OrgGuard)
  getIntegrationStatus(@Headers('x-org-id') orgId?: string) {
    return this.integrationsService.getIntegrationStatus(orgId || '');
  }
}
