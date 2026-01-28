import { ProgramType } from '@prisma/client';
import { IsIn, IsNotEmpty, IsOptional, IsString, IsBoolean } from 'class-validator';

export class CreateProgramDto {
  @IsString()
  @IsNotEmpty()
  name!: string;

  @IsString()
  @IsIn(['AB', 'PPL', 'FULL_BODY', 'CUSTOM'])
  type!: ProgramType;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
