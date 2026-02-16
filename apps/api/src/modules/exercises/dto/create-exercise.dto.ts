import { MuscleGroup } from '@prisma/client';

import { IsEnum, IsNotEmpty, IsString } from 'class-validator';

export class CreateExerciseDto {
  @IsString()
  @IsNotEmpty()
  name!: string;
  
  @IsEnum(MuscleGroup)
  primaryMuscle!: MuscleGroup;
}