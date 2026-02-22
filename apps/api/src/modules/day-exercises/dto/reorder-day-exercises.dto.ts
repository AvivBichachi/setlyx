import { Type } from 'class-transformer';
import { ArrayMinSize, IsArray, IsInt, ValidateNested } from 'class-validator';

class DayExerciseOrderItemDto {
  @IsInt()
  id!: number;

  @IsInt()
  order!: number;
}

export class ReorderDayExercisesDto {
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => DayExerciseOrderItemDto)
  items!: DayExerciseOrderItemDto[];
}
