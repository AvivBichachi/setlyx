import { PartialType, OmitType } from '@nestjs/mapped-types';
import { CreateDayExerciseDto } from './create-day-exercise.dto';

export class UpdateDayExerciseDto extends PartialType(
  OmitType(CreateDayExerciseDto, ['exerciseId'] as const),
) {}