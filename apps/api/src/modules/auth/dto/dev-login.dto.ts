import { IsInt, Min } from 'class-validator';

export class DevLoginDto {
  @IsInt()
  @Min(1)
  userId!: number;
}
