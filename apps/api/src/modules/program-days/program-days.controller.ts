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
import { CurrentUserId } from '../../common/current-user-id.decorator';

@Controller('programs/:programId/days')
export class ProgramDaysController {
  constructor(private readonly programDaysService: ProgramDaysService) {}

  @Post()
  create(
    @CurrentUserId() userId: number,
    @Param('programId', ParseIntPipe) programId: number,
    @Body() dto: CreateProgramDayDto,
  ) {
    return this.programDaysService.create(userId, programId, dto);
  }

  @Get()
  findAll(
    @CurrentUserId() userId: number,
    @Param('programId', ParseIntPipe) programId: number,
  ) {
    return this.programDaysService.findAll(userId, programId);
  }

  @Get(':dayId')
  findOne(
    @CurrentUserId() userId: number,
    @Param('programId', ParseIntPipe) programId: number,
    @Param('dayId', ParseIntPipe) dayId: number,
  ) {
    return this.programDaysService.findOne(userId, programId, dayId);
  }

  @Patch(':dayId')
  update(
    @CurrentUserId() userId: number,
    @Param('programId', ParseIntPipe) programId: number,
    @Param('dayId', ParseIntPipe) dayId: number,
    @Body() dto: UpdateProgramDayDto,
  ) {
    return this.programDaysService.update(userId, programId, dayId, dto);
  }

  @Delete(':dayId')
  async remove(
    @CurrentUserId() userId: number,
    @Param('programId', ParseIntPipe) programId: number,
    @Param('dayId', ParseIntPipe) dayId: number,
  ) {
    await this.programDaysService.remove(userId, programId, dayId);
    return { ok: true };
  }
}