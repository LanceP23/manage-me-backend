import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  HttpStatus,
  HttpCode,
  ParseIntPipe,
  Headers,
  UseGuards,
} from '@nestjs/common';
import { ProductService } from './product.service';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';
import { AiProviderService } from '../ai-agent/ai-provider.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { OrgGuard } from '../organization/guards/org.guard';

@Controller('product')
@UseGuards(JwtAuthGuard, OrgGuard)
export class ProductController {
  constructor(
    private readonly productService: ProductService,
    private readonly aiProvider: AiProviderService,
  ) {}

  @Post()
  create(
    @Body() createProductDto: CreateProductDto,
    @Headers('x-org-id') orgId?: string,
  ) {
    return this.productService.create(
      createProductDto,
      this.aiProvider.getProvider(),
      orgId,
    );
  }

  @Get()
  findAll(@Headers('x-org-id') orgId?: string) {
    return this.productService.findAll(orgId);
  }

  @Get(':id')
  findOne(
    @Param('id', ParseIntPipe) id: number,
    @Headers('x-org-id') orgId?: string,
  ) {
    return this.productService.findOne(id, orgId);
  }

  @Patch(':id')
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() updateProductDto: UpdateProductDto,
    @Headers('x-org-id') orgId?: string,
  ) {
    return this.productService.update(id, updateProductDto, orgId);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(
    @Param('id', ParseIntPipe) id: number,
    @Headers('x-org-id') orgId?: string,
  ) {
    return this.productService.remove(id, orgId);
  }
}
