import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Product } from './entities/Product.entity';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';
import { ProductContextService } from 'src/product-context/services/product-context.service';
import { AiAgentInterface } from 'src/ai-agent/interfaces/AiAgent.interface';
import { Organization } from 'src/organization/entities/organization.entity';

@Injectable()
export class ProductService {
  constructor(
    @InjectRepository(Product)
    private productRepository: Repository<Product>,
    private productContextService: ProductContextService,
    @InjectRepository(Organization)
    private organizationRepository: Repository<Organization>,
  ) {}

  async create(
    createProductDto: CreateProductDto,
    aiAgent: AiAgentInterface,
    organizationId?: string,
  ): Promise<Product> {
    const product = this.productRepository.create(createProductDto);
    if (organizationId) {
      const organization = await this.organizationRepository.findOne({
        where: { id: organizationId },
      });
      if (!organization) {
        throw new NotFoundException(
          `Organization with ID ${organizationId} not found`,
        );
      }
      product.organization = organization;
      product.organizationId = organization.id;
    }
    const savedProduct = await this.productRepository.save(product);
    await this.productContextService.createProductContext(savedProduct, aiAgent);
    return savedProduct;
  }

  async findAll(organizationId?: string): Promise<Product[]> {
    const where = organizationId ? { organizationId } : {};
    return this.productRepository.find({
      where,
      relations: ['productContext', 'user'],
    });
  }

  async findOne(id: number, organizationId?: string): Promise<Product | null> {
    return this.productRepository.findOne({
      where: organizationId ? { id, organizationId } : { id },
      relations: ['productContext', 'user'],
    });
  }

  async update(
    id: number,
    updateProductDto: UpdateProductDto,
    organizationId?: string,
  ): Promise<Product> {
    const product = await this.findOne(id, organizationId);
    if (!product) {
      throw new NotFoundException(`Product with ID ${id} not found`);
    }

    const hasUpdates = Object.keys(updateProductDto).length > 0;
    
    if (hasUpdates) {
      await this.productRepository.update(id, updateProductDto);
    }
    
    const updatedProduct = await this.findOne(id, organizationId);
    if (!updatedProduct) {
      throw new NotFoundException(
        `Product with ID ${id} not found after update`,
      );
    }
    return updatedProduct;
  }

  async remove(id: number, organizationId?: string): Promise<void> {
    const product = await this.findOne(id, organizationId);
    if (!product) {
      throw new NotFoundException(`Product with ID ${id} not found`);
    }

    await this.productRepository.delete(id);
  }
}
