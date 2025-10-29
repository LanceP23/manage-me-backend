import {
  Controller,
  Post,
  Body,
  Param,
  ParseIntPipe,
  Get,
  UseInterceptors,
  UploadedFile,
} from '@nestjs/common';
import { CreateContextDto } from './dto/create-context.dto';
import { ProductContextService } from './services/product-context.service';
import { ProductService } from 'src/product/product.service';
import { GoogleGeminiAi } from 'src/ai-agent/entities/GoogleGeminiAi.entity';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { extname } from 'path';

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

  @Get('q&a/:id')
  async getQuestionsWithAnswersByProductId(
    @Param('id', ParseIntPipe) productId: number,
  ) {
    const productContext =
      await this.productContextService.getQuestionsWithAnswersByProductId(
        productId,
      );

    return {
      message: 'Product Context fetched successfully',
      productContext,
    };
  }

  @Post('upload/product/:id')
  @UseInterceptors(
    FileInterceptor('image', {
      storage: diskStorage({
        destination: './uploads',
        filename: (req, file, cb) => {
          const uniqueSuffix =
            Date.now() + '-' + Math.round(Math.random() * 1e9);
          cb(
            null,
            `${file.fieldname}-${uniqueSuffix}${extname(file.originalname)}`,
          );
        },
      }),
    }),
  )
  async uploadImage(
    @UploadedFile() file: Express.Multer.File,
    @Param('id', ParseIntPipe) productId: number,
  ) {
    const filePath = file.path;

    const productContext = this.productContextService.addImage(
      productId,
      filePath,
    );

    return {
      message: 'Image uploaded successfully',
      imageUrl: filePath,
      productContext: productContext,
    };
  }
}
