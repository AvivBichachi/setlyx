import { PartialType } from '@nestjs/mapped-types';
import { CreateDayExerciseDto } from './create-day-exercise.dto';

export class UpdateDayExerciseDto extends PartialType(CreateDayExerciseDto) {}