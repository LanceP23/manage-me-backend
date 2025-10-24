import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Answer } from './entities/answer.entity';
import { CreateAnswerDto } from './dto/create-answer.dto';
import { UpdateAnswerDto } from './dto/update-answer.dto';

@Injectable()
export class AnswerService {
  constructor(
    @InjectRepository(Answer)
    private answerRepository: Repository<Answer>,
  ) {}

  async create(createAnswerDto: CreateAnswerDto): Promise<Answer> {
    const answer = this.answerRepository.create(createAnswerDto);
    return this.answerRepository.save(answer);
  }

  async findAll(): Promise<Answer[]> {
    return this.answerRepository.find({
      relations: ['productContext', 'productQuestion', 'user'],
    });
  }

  async findOne(id: number): Promise<Answer | null> {
    return this.answerRepository.findOne({
      where: { id },
      relations: ['productContext', 'productQuestion', 'user'],
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
      throw new NotFoundException(`Answer with ID ${id} not found after update`);
    }
    return updatedAnswer;
  }

  async remove(id: number): Promise<void> {
    const answer = await this.findOne(id);
    if (!answer) {
      throw new NotFoundException(`Answer with ID ${id} not found`);
    }

    await this.answerRepository.delete(id);
  }
}