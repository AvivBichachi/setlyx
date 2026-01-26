import { IsNotEmpty, IsString } from 'class-validator';

export class CreateExerciseDto {
  @IsString()
  @IsNotEmpty()
  name!: string;
}