import {IsString, IsNotEmpty, IsEnum, isEnum} from "class-validator";

export class SendPromptDto{

  @IsString()
  @IsNotEmpty()
  prompt: string;
}

