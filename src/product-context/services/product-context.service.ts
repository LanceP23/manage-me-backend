import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { ProductContext } from '../entities/ProductContext.entity';
import { Repository } from 'typeorm';
import { Product } from 'src/product/entities/Product.entity';
import { AiAgentInterface } from 'src/ai-agent/interfaces/AiAgent.interface';
import { ProductQuestion } from 'src/product-question/entities/product-question.entity';
import { GENERATE_QUESTIONS_PROMPTS } from '../constants/prompts.constant';
import { NotFoundException } from '@nestjs/common';

@Injectable()
export class ProductContextService {
  constructor(
    @InjectRepository(ProductContext)
    private productContextRepository: Repository<ProductContext>,
    @InjectRepository(ProductQuestion)
    private productQuestionRepository: Repository<ProductQuestion>,
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

    const prompt = GENERATE_QUESTIONS_PROMPTS.PROMPT_1;
    const response = await aiAgent.generateResponse(prompt);

    let questionsJson = await this.parseResponseToJson(response);

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
      console.error('❌ Failed to parse AI response:', error);
      console.error('Response content:', response);
      throw new Error('Invalid AI response format');
    }
    return questionsJson;
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

    // If images array doesn’t exist yet, create it
    productContext.images = productContext.images
      ? [...productContext.images, imagePath]
      : [imagePath];

    return this.productContextRepository.save(productContext);
  }
}
