import { Type, Transform } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsIn,
  IsArray,
  IsOptional,
  IsString,
  MaxLength,
  ValidateNested,
} from 'class-validator';

export class TriagePastTicketDto {
  @IsOptional()
  @Transform(({ value }) =>
    value === null || value === undefined ? undefined : String(value),
  )
  @IsString()
  id?: string;

  @IsString()
  @MaxLength(200)
  title: string;

  @IsOptional()
  @IsString()
  @MaxLength(5000)
  description?: string;

  @IsOptional()
  @IsString()
  @MaxLength(32)
  priority?: string;

  @IsOptional()
  @IsString()
  @MaxLength(32)
  status?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  ownerHint?: string;
}

export class TriageCandidateOwnerDto {
  @IsString()
  @MaxLength(64)
  id: string;

  @IsString()
  @MaxLength(120)
  name: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  role?: string;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(20)
  @IsString({ each: true })
  skills?: string[];
}

export class TriageContextDto {
  @IsOptional()
  @IsString()
  @MaxLength(120)
  productArea?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  environment?: string;
}

export class AnalyzeTicketTriageDto {
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(20)
  @IsString({ each: true })
  rawReports: string[];

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(50)
  @ValidateNested({ each: true })
  @Type(() => TriagePastTicketDto)
  pastTickets?: TriagePastTicketDto[];

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(50)
  @ValidateNested({ each: true })
  @Type(() => TriageCandidateOwnerDto)
  candidateOwners?: TriageCandidateOwnerDto[];

  @IsOptional()
  @ValidateNested()
  @Type(() => TriageContextDto)
  context?: TriageContextDto;

  @IsOptional()
  @IsString()
  @IsIn(['heuristic', 'hybrid'])
  mode?: 'heuristic' | 'hybrid';
}
