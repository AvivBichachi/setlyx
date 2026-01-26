import { IsInt, IsNumber, Min } from 'class-validator';

export class CreateWorkoutSetDto {
  @IsInt()
  @Min(1)
  dayExerciseId!: number;

  @IsInt()
  @Min(1)
  setNumber!: number;

  @IsInt()
  @Min(1)
  reps!: number;

  @IsNumber()
  @Min(0)
  weight!: number;
}