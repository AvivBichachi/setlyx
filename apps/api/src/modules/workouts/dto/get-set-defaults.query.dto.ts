import { IsInt } from 'class-validator';
import { Type } from 'class-transformer';

export class GetSetDefaultsQueryDto {
  @Type(() => Number)
  @IsInt()
  dayExerciseId!: number;
}