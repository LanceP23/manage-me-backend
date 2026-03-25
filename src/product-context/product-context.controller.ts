import {
  Controller,
  Post,
  Body,
  Param,
  ParseIntPipe,
  Get,
  UseInterceptors,
  UploadedFile,
  Headers,
  UseGuards,
} from '@nestjs/common';
import { CreateContextDto } from './dto/create-context.dto';
import { ProductContextService } from './services/product-context.service';
import { ProductService } from 'src/product/product.service';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { extname } from 'path';
import { AiProviderService } from 'src/ai-agent/ai-provider.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { OrgGuard } from '../organization/guards/org.guard';

@Controller('product-context')
@UseGuards(JwtAuthGuard, OrgGuard)
export class ProductContextController {
  constructor(
    private readonly productContextService: ProductContextService,
    private readonly productService: ProductService,
    private readonly aiProvider: AiProviderService,
  ) {}

  @Post('product/:id')
  async createContext(
    @Param('id', ParseIntPipe) productId: number,
    @Body() createContextDto: CreateContextDto,
    @Headers('x-org-id') orgId?: string,
  ) {
    // Get the product using the ID
    const product = await this.productService.findOne(productId, orgId);
    if (!product) {
      // Handle case where product doesn't exist
      throw new Error(`Product with ID ${productId} not found`);
    }

    const productContext =
      await this.productContextService.createProductContext(
        product,
        this.aiProvider.getProvider(),
      );
    return { message: 'created successfully', productContext };
  }

  @Get('q&a/:id')
  async getQuestionsWithAnswersByProductId(
    @Param('id', ParseIntPipe) productId: number,
    @Headers('x-org-id') orgId?: string,
  ) {
    const product = await this.productService.findOne(productId, orgId);
    if (!product) {
      throw new Error(`Product with ID ${productId} not found`);
    }
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
    @Headers('x-org-id') orgId?: string,
  ) {
    const filePath = file.path;

    const product = await this.productService.findOne(productId, orgId);
    if (!product) {
      throw new Error(`Product with ID ${productId} not found`);
    }

    const productContext = this.productContextService.addImage(productId, filePath);

    return {
      message: 'Image uploaded successfully',
      imageUrl: filePath,
      productContext: productContext,
    };
  }

  @Post('analyze/product/:id')
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
  async analyzeImageAndGenerateTickets(
    @UploadedFile() file: Express.Multer.File,
    @Param('id', ParseIntPipe) productId: number,
    @Headers('x-org-id') orgId?: string,
  ) {
    if (!file) {
      throw new Error('No file uploaded');
    }
    
    const filePath = file.path;

    const product = await this.productService.findOne(productId, orgId);
    if (!product) {
      throw new Error(`Product with ID ${productId} not found`);
    }

    await this.productContextService.addImage(productId, filePath);

    const result =
      await this.productContextService.analyzeImageAndGenerateTickets(
        productId,
        filePath,
        this.aiProvider.getProvider(),
      );

    return result;
  }
}
