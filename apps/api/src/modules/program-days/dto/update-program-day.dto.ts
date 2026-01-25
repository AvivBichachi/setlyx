import { PartialType } from '@nestjs/mapped-types';
import { CreateProgramDayDto } from './create-program-day.dto';

export class UpdateProgramDayDto extends PartialType(CreateProgramDayDto) {}