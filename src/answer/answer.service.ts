import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Answer } from './entities/answer.entity';
import { CreateAnswerDto } from './dto/create-answer.dto';
import { UpdateAnswerDto } from './dto/update-answer.dto';
import { ProductContext } from 'src/product-context/entities/ProductContext.entity';
import { ProductQuestion } from 'src/product-question/entities/product-question.entity';
import { User } from 'src/users/entities/user.entity';
import { KnowledgeService } from '../knowledge/knowledge.service';

@Injectable()
export class AnswerService {
  constructor(
    @InjectRepository(Answer)
    private answerRepository: Repository<Answer>,
    @InjectRepository(ProductContext)
    private productContextRepository: Repository<ProductContext>,
    @InjectRepository(ProductQuestion)
    private productQuestionRepository: Repository<ProductQuestion>,
    @InjectRepository(User)
    private userRepository: Repository<User>,
    private readonly knowledgeService: KnowledgeService,
  ) {}

  async create(createAnswerDto: CreateAnswerDto): Promise<Answer> {
    // Fetch the related entities
    const productContext = await this.productContextRepository.findOneBy({
      id: createAnswerDto.productContextId,
    });

    if (!productContext) {
      throw new NotFoundException(
        `ProductContext with ID ${createAnswerDto.productContextId} not found`,
      );
    }

    const user = await this.userRepository.findOneBy({
      id: createAnswerDto.userId,
    });

    if (!user) {
      throw new NotFoundException(
        `User with ID ${createAnswerDto.userId} not found`,
      );
    }

    let productQuestion: ProductQuestion | null = null;
    if (createAnswerDto.productQuestionId) {
      productQuestion = await this.productQuestionRepository.findOneBy({
        id: createAnswerDto.productQuestionId,
      });

      if (!productQuestion) {
        throw new NotFoundException(
          `ProductQuestion with ID ${createAnswerDto.productQuestionId} not found`,
        );
      }
    } else {
      throw new Error('Question Id is needed');
    }

    if (!productQuestion || !productContext || !user)
      throw new Error('Question Id is needed');
    // Create the answer with proper relations
    const answer = this.answerRepository.create({
      answerText: createAnswerDto.answerText,
      productContext,
      productQuestion,
      user,
    });

    const savedAnswer = await this.answerRepository.save(answer);
    await this.knowledgeService.indexAnswerById(savedAnswer.id);
    return savedAnswer;
  }

  async findAll(): Promise<Answer[]> {
    return this.answerRepository.find({
      relations: ['productContext', 'productQuestion', 'user'],
    });
  }

  async findOne(id: number): Promise<Answer | null> {
    return this.answerRepository.findOne({
      where: { id },
      relations: ['productContext', 'productContext.product', 'productQuestion', 'user'],
    });
  }

  async update(id: number, updateAnswerDto: UpdateAnswerDto): Promise<Answer> {
    const answer = await this.findOne(id);
    if (!answer) {
      throw new NotFoundException(`Answer with ID ${id} not found`);
    }

    await this.answerRepository.update(id, updateAnswerDto);
    const updatedAnswer = await this.findOne(id);
    if (!updatedAnswer) {
      throw new NotFoundException(
        `Answer with ID ${id} not found after update`,
      );
    }
    await this.knowledgeService.indexAnswerById(updatedAnswer.id);
    return updatedAnswer;
  }

  async remove(id: number): Promise<void> {
    const answer = await this.findOne(id);
    if (!answer) {
      throw new NotFoundException(`Answer with ID ${id} not found`);
    }

    await this.knowledgeService.removeAnswerById(
      answer.id,
      answer.productContext?.product?.organizationId ?? undefined,
    );
    await this.answerRepository.delete(id);
  }
}
