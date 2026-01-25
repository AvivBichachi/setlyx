import { IsInt, IsNotEmpty, IsString, Min } from 'class-validator';

export class CreateProgramDayDto {
  @IsString()
  @IsNotEmpty()
  name!: string;

  @IsInt()
  @Min(1)
  order!: number;
}