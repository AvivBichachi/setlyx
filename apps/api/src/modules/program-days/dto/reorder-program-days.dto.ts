import { Type } from 'class-transformer';
import { ArrayMinSize, IsArray, IsInt, ValidateNested } from 'class-validator';

class ProgramDayOrderItemDto {
  @IsInt()
  id!: number;

  @IsInt()
  order!: number;
}

export class ReorderProgramDaysDto {
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => ProgramDayOrderItemDto)
  items!: ProgramDayOrderItemDto[];
}
