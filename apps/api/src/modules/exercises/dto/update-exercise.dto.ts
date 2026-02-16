import { IsOptional, IsString, IsNotEmpty } from 'class-validator';

export class UpdateExerciseDto {
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  name?: string;
}
