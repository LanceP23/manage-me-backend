import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Product } from './entities/Product.entity';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';
import { ProductContextService } from 'src/product-context/services/product-context.service';
import { AiAgentInterface } from 'src/ai-agent/interfaces/AiAgent.interface';

@Injectable()
export class ProductService {
  constructor(
    @InjectRepository(Product)
    private productRepository: Repository<Product>,
    private productContextService: ProductContextService,
  ) {}

  async create(
    createProductDto: CreateProductDto,
    aiAgent: AiAgentInterface,
  ): Promise<Product> {
    const product = this.productRepository.create(createProductDto);
    this.productContextService.createProductContext(product, aiAgent);
    return this.productRepository.save(product);
  }

  async findAll(): Promise<Product[]> {
    return this.productRepository.find({
      relations: ['productContext', 'user'],
    });
  }

  async findOne(id: number): Promise<Product | null> {
    return this.productRepository.findOne({
      where: { id },
      relations: ['productContext', 'user'],
    });
  }

  async update(
    id: number,
    updateProductDto: UpdateProductDto,
  ): Promise<Product> {
    const product = await this.findOne(id);
    if (!product) {
      throw new NotFoundException(`Product with ID ${id} not found`);
    }

    // Check if any updates are provided
    const hasUpdates = Object.keys(updateProductDto).length > 0;
    
    if (hasUpdates) {
      await this.productRepository.update(id, updateProductDto);
    }
    
    const updatedProduct = await this.findOne(id);
    if (!updatedProduct) {
      throw new NotFoundException(
        `Product with ID ${id} not found after update`,
      );
    }
    return updatedProduct;
  }

  async remove(id: number): Promise<void> {
    const product = await this.findOne(id);
    if (!product) {
      throw new NotFoundException(`Product with ID ${id} not found`);
    }

    await this.productRepository.delete(id);
  }
}
