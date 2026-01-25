import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
} from '@nestjs/common';
import { ProgramDaysService } from './program-days.service';
import { CreateProgramDayDto } from './dto/create-program-day.dto';
import { UpdateProgramDayDto } from './dto/update-program-day.dto';

@Controller('programs/:programId/days')
export class ProgramDaysController {
  constructor(private readonly programDaysService: ProgramDaysService) {}

  @Post()
  create(
    @Param('programId', ParseIntPipe) programId: number,
    @Body() dto: CreateProgramDayDto,
  ) {
    return this.programDaysService.create(programId, dto);
  }

  @Get()
  findAll(@Param('programId', ParseIntPipe) programId: number) {
    return this.programDaysService.findAll(programId);
  }

  @Get(':dayId')
  findOne(
    @Param('programId', ParseIntPipe) programId: number,
    @Param('dayId', ParseIntPipe) dayId: number,
  ) {
    return this.programDaysService.findOne(programId, dayId);
  }

  @Patch(':dayId')
  update(
    @Param('programId', ParseIntPipe) programId: number,
    @Param('dayId', ParseIntPipe) dayId: number,
    @Body() dto: UpdateProgramDayDto,
  ) {
    return this.programDaysService.update(programId, dayId, dto);
  }

  @Delete(':dayId')
  async remove(
    @Param('programId', ParseIntPipe) programId: number,
    @Param('dayId', ParseIntPipe) dayId: number,
  ) {
    await this.programDaysService.remove(programId, dayId);
    return { ok: true };
  }
}