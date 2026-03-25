import { IsNotEmpty, IsInt, Min } from 'class-validator';

export class RetentionPolicyDto {
  @IsNotEmpty()
  @IsInt()
  @Min(1)
  days: number;
}
