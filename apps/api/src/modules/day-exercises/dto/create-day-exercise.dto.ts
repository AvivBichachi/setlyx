import { IsInt, Min } from 'class-validator';

export class CreateDayExerciseDto {
  @IsInt()
  @Min(1)
  exerciseId!: number;

  @IsInt()
  @Min(1)
  order!: number;

  @IsInt()
  @Min(1)
  targetSets!: number;

  @IsInt()
  @Min(1)
  minReps!: number;

  @IsInt()
  @Min(1)
  maxReps!: number;
}