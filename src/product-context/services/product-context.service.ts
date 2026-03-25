import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { ProductContext } from '../entities/ProductContext.entity';
import { Repository } from 'typeorm';
import { Product } from 'src/product/entities/Product.entity';
import { AiAgentInterface } from 'src/ai-agent/interfaces/AiAgent.interface';
import { ProductQuestion } from 'src/product-question/entities/product-question.entity';
import {
  PRODUCT_CONTEXT_QUESTIONS_PROMPT_V1,
  IMAGE_TICKET_DRAFTS_PROMPT_V1,
} from 'src/ai-agent/prompts/product-context.prompts';
import { NotFoundException } from '@nestjs/common';
import { TicketDraftService } from 'src/ticket/ticket-draft.service';
import { AiEvaluationLogService } from 'src/ai-agent/ai-evaluation.service';

@Injectable()
export class ProductContextService {
  constructor(
    @InjectRepository(ProductContext)
    private productContextRepository: Repository<ProductContext>,
    @InjectRepository(ProductQuestion)
    private productQuestionRepository: Repository<ProductQuestion>,
    private ticketDraftService: TicketDraftService,
    private aiEvaluationLogService: AiEvaluationLogService,
  ) {}

  async createProductContext(product: Product, aiAgent: AiAgentInterface) {
    let productContext: ProductContext;

    if (product.productContext) {
      productContext = await this.productContextRepository.findOneOrFail({
        where: { id: product.productContext.id },
        relations: ['productQuestions', 'answers'],
      });
    } else {
      productContext = this.productContextRepository.create({
        product,
      });

      productContext = await this.productContextRepository.save(productContext);
    }

    // First save the product context to establish the product relationship
    await this.productContextRepository.save(productContext);

    const prompt = PRODUCT_CONTEXT_QUESTIONS_PROMPT_V1.prompt;
    let response = '';
    try {
      response = await aiAgent.generateResponse(prompt);
      await this.aiEvaluationLogService.logSuccess({
        provider: aiAgent.providerName,
        prompt,
        response,
        context: aiAgent.context,
        organizationId: product.organizationId || null,
        metadata: {
          type: 'product-context-questions',
          productId: product.id,
          promptVersion: PRODUCT_CONTEXT_QUESTIONS_PROMPT_V1.version,
        },
      });
    } catch (error) {
      await this.aiEvaluationLogService.logFailure({
        provider: aiAgent.providerName,
        prompt,
        context: aiAgent.context,
        organizationId: product.organizationId || null,
        errorMessage: error?.message || 'AI generation failed',
        metadata: {
          type: 'product-context-questions',
          productId: product.id,
          promptVersion: PRODUCT_CONTEXT_QUESTIONS_PROMPT_V1.version,
        },
      });
      throw error;
    }

    let questionsJson: { id: number; question: string }[] = [];
    try {
      questionsJson = await this.parseResponseToJson(response);
    } catch (error) {
      const fallbackQuestions = this.getDefaultQuestions();
      questionsJson = fallbackQuestions.map((question, index) => ({
        id: index + 1,
        question,
      }));
    }

    const productQuestions = questionsJson.map((q) => {
      const pq = new ProductQuestion();
      pq.questionText = q.question;
      pq.productContext = productContext;
      return pq;
    });

    // Save product questions with the product context relation
    const savedQuestions =
      await this.productQuestionRepository.save(productQuestions);

    // Return a plain object to avoid circular reference issues
    return {
      id: productContext.id,
      createdAt: productContext.createdAt,
      productQuestions: savedQuestions.map((pq) => ({
        id: pq.id,
        questionText: pq.questionText,
        createdAt: pq.createdAt,
      })),
    };
  }

  async getQuestionsWithAnswersByProductId(
    productId: number,
  ): Promise<ProductContext> {
    const productContext = await this.productContextRepository.findOneOrFail({
      where: {
        product: { id: productId },
      },
      relations: ['product', 'productQuestions', 'answers'],
    });

    return productContext;
  }

  async parseResponseToJson(
    response: string,
  ): Promise<{ id: number; question: string }[]> {
    let questionsJson: { id: number; question: string }[] = [];
    try {
      // Some LLMs wrap JSON in code blocks or have stray text
      const cleanResponse = response
        .trim()
        .replace(/```(json)?/g, '')
        .replace(/```/g, '');

      questionsJson = JSON.parse(cleanResponse);
    } catch (error) {
      const fallback = this.extractNumberedQuestions(response);
      if (fallback.length) {
        return fallback.map((question, index) => ({
          id: index + 1,
          question,
        }));
      }
      console.error('❌ Failed to parse AI response:', error);
      console.error('Response content:', response);
      throw new Error('Invalid AI response format');
    }
    return questionsJson;
  }

  private extractNumberedQuestions(response: string): string[] {
    if (!response) {
      return [];
    }
    return response
      .split('\n')
      .map((line) => line.trim())
      .map((line) => line.replace(/^\d+\\.?\\s*/, '').trim())
      .filter((line) => line.length > 0 && /^[A-Za-z]/.test(line));
  }

  private getDefaultQuestions(): string[] {
    return [
      'What is the primary goal of this product?',
      'Who are the target users for this product?',
      'What are the key features or workflows?',
      'Are there known issues or bugs to address first?',
      'What are the technical constraints or requirements?',
      'What integrations are required (if any)?',
      'What is the expected timeline or milestone?',
      'Who are the main stakeholders and owners?',
      'What risks or dependencies should we track?',
      'How should new tickets be prioritized?',
    ];
  }

  async addImage(productId: number, imagePath: string) {
    const productContext = await this.productContextRepository.findOne({
      where: {
        product: { id: productId },
      },
      relations: ['product'],
    });

    if (!productContext) {
      throw new NotFoundException(
        `ProductContext not found for product ${productId}`,
      );
    }

    // If images array doesn't exist yet, create it
    productContext.images = productContext.images
      ? [...productContext.images, imagePath]
      : [imagePath];

    return this.productContextRepository.save(productContext);
  }

  async analyzeImageAndGenerateTickets(
    productId: number,
    imagePath: string,
    aiAgent: AiAgentInterface,
  ): Promise<any> {
    let productContext: ProductContext | null = null;
    try {
      productContext = await this.getQuestionsWithAnswersByProductId(productId);
    } catch (error) {
      console.log('No product context found, proceeding without it');
    }

    let contextText = '';
    if (
      productContext &&
      productContext.productQuestions &&
      productContext.productQuestions.length > 0
    ) {
      const lines: string[] = [];
      productContext.productQuestions.forEach((question) => {
        const answer = productContext.answers.find(
          (a) => a.productQuestion && a.productQuestion.id === question.id,
        );
        if (answer) {
          lines.push(`Q: ${question.questionText}`);
          lines.push(`A: ${answer.answerText}`);
          lines.push('');
        }
      });
      contextText = lines.join('\n').trim();
    }

    const imageAnalysisPrompt = IMAGE_TICKET_DRAFTS_PROMPT_V1.build(
      contextText || undefined,
    );

    // Process image with AI to generate tickets directly
    let aiResponse = '';
    try {
      aiResponse = await aiAgent.generateResponseWithImage(
        imageAnalysisPrompt,
        imagePath,
      );
      await this.aiEvaluationLogService.logSuccess({
        provider: aiAgent.providerName,
        prompt: imageAnalysisPrompt,
        response: aiResponse,
        context: aiAgent.context,
        organizationId: productContext?.product?.organizationId || null,
        metadata: {
          type: 'image-ticket-drafts',
          productId,
          imagePath,
          promptVersion: IMAGE_TICKET_DRAFTS_PROMPT_V1.version,
        },
      });
    } catch (error) {
      await this.aiEvaluationLogService.logFailure({
        provider: aiAgent.providerName,
        prompt: imageAnalysisPrompt,
        context: aiAgent.context,
        organizationId: productContext?.product?.organizationId || null,
        errorMessage: error?.message || 'AI image analysis failed',
        metadata: {
          type: 'image-ticket-drafts',
          productId,
          imagePath,
          promptVersion: IMAGE_TICKET_DRAFTS_PROMPT_V1.version,
        },
      });
      throw error;
    }

    // Parse AI response
    let ticketsToCreate: any[] = [];
    try {
      const cleanResponse = aiResponse
        .trim()
        .replace(/```(json)?/g, '')
        .replace(/```/g, '');
      const start = cleanResponse.indexOf('[');
      const end = cleanResponse.lastIndexOf(']');
      const extracted =
        start !== -1 && end !== -1 && end > start
          ? cleanResponse.slice(start, end + 1)
          : cleanResponse;
      ticketsToCreate = JSON.parse(extracted);
    } catch (error) {
      console.error('Failed to parse AI response:', error);
      await this.aiEvaluationLogService.logFailure({
        provider: aiAgent.providerName,
        prompt: imageAnalysisPrompt,
        response: aiResponse,
        context: aiAgent.context,
        organizationId: productContext?.product?.organizationId || null,
        errorMessage: error?.message || 'Invalid AI response format',
        metadata: {
          type: 'image-ticket-drafts',
          productId,
          imagePath,
          promptVersion: IMAGE_TICKET_DRAFTS_PROMPT_V1.version,
        },
      });
      throw new Error('Invalid AI response format');
    }

    const drafts = ticketsToCreate.map((ticketData) => ({
      title: ticketData.title,
      description: ticketData.description,
      status: ticketData.status || 'todo',
      priority: ticketData.priority || 'medium',
      source: 'scrape',
      aiProvider: aiAgent.providerName,
      confidence:
        typeof ticketData.confidence === 'number'
          ? ticketData.confidence
          : undefined,
      rawInputHash: undefined,
      productId,
    }));

    const orgId = productContext?.product?.organizationId || undefined;
    const createdDrafts = await this.ticketDraftService.createDrafts(drafts, orgId);

    return {
      message: `Successfully created ${createdDrafts.length} ticket drafts from image`,
      drafts: createdDrafts,
    };
  }
}
