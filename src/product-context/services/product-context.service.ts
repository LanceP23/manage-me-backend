import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { ProductContext } from '../entities/ProductContext.entity';
import { Repository } from 'typeorm';
import { Product } from 'src/product/entities/Product.entity';
import { AiAgentInterface } from 'src/ai-agent/interfaces/AiAgent.interface';
import { ProductQuestion } from 'src/product-question/entities/product-question.entity';
import { GENERATE_QUESTIONS_PROMPTS } from '../constants/prompts.constant';

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
      // ✅ If the product already has a context, fetch it
      productContext = await this.productContextRepository.findOneOrFail({
        where: { id: product.productContext.id },
        relations: ['productQuestions', 'answers'],
      });
    } else {
      // ✅ Otherwise, create a new context for this product
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
}
