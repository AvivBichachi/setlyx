import { IsEnum, IsInt, Min } from 'class-validator';
import { Type } from 'class-transformer';

export enum ProgressMetric {
  E1RM = 'e1rm',
  VOLUME = 'volume',
}

export class GetProgressQueryDto {
  @Type(() => Number)
  @IsInt()
  @Min(1)
  programId!: number;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  programDayId!: number;

  @IsEnum(ProgressMetric)
  metric!: ProgressMetric;
}
