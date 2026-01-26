import { IsInt, Min } from 'class-validator';

export class StartWorkoutSessionDto {
  @IsInt()
  @Min(1)
  programId!: number;

  @IsInt()
  @Min(1)
  programDayId!: number;
}