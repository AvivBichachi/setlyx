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
import { DayExercisesService } from './day-exercises.service';
import { CreateDayExerciseDto } from './dto/create-day-exercise.dto';
import { UpdateDayExerciseDto } from './dto/update-day-exercise.dto';

@Controller('programs/:programId/days/:dayId/exercises')
export class DayExercisesController {
  constructor(private readonly dayExercisesService: DayExercisesService) {}

  @Post()
  create(
    @Param('programId', ParseIntPipe) programId: number,
    @Param('dayId', ParseIntPipe) dayId: number,
    @Body() dto: CreateDayExerciseDto,
  ) {
    return this.dayExercisesService.create(programId, dayId, dto);
  }

  @Get()
  findAll(
    @Param('programId', ParseIntPipe) programId: number,
    @Param('dayId', ParseIntPipe) dayId: number,
  ) {
    return this.dayExercisesService.findAll(programId, dayId);
  }

  @Patch(':dayExerciseId')
  update(
    @Param('programId', ParseIntPipe) programId: number,
    @Param('dayId', ParseIntPipe) dayId: number,
    @Param('dayExerciseId', ParseIntPipe) dayExerciseId: number,
    @Body() dto: UpdateDayExerciseDto,
  ) {
    return this.dayExercisesService.update(programId, dayId, dayExerciseId, dto);
  }

  @Delete(':dayExerciseId')
  async remove(
    @Param('programId', ParseIntPipe) programId: number,
    @Param('dayId', ParseIntPipe) dayId: number,
    @Param('dayExerciseId', ParseIntPipe) dayExerciseId: number,
  ) {
    await this.dayExercisesService.remove(programId, dayId, dayExerciseId);
    return { ok: true };
  }
}