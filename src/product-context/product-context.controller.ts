import {
  Controller,
  Post,
  Body,
  Param,
  ParseIntPipe,
} from '@nestjs/common';
import { CreateContextDto } from './dto/create-context.dto';
import { ProductContextService } from './services/product-context.service';
import { ProductService } from 'src/product/product.service';
import { GoogleGeminiAi } from 'src/ai-agent/entities/GoogleGeminiAi.entity';

@Controller('product-context')
export class ProductContextController {
  constructor(
    private readonly productContextService: ProductContextService,
    private readonly productService: ProductService,
    private readonly aiAgent: GoogleGeminiAi,
  ) {}

  @Post('product/:id')
  async createContext(
    @Param('id', ParseIntPipe) productId: number,
    @Body() createContextDto: CreateContextDto,
  ) {
    // Get the product using the ID
    const product = await this.productService.findOne(productId);
    if (!product) {
      // Handle case where product doesn't exist
      throw new Error(`Product with ID ${productId} not found`);
    }

    const productContext =
      await this.productContextService.createProductContext(
        product,
        this.aiAgent,
      );
    return { message: 'created successfully', productContext };
  }
}
