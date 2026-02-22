import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { CurrentUserId } from '../../common/current-user-id.decorator';
import { DayExercisesService } from './day-exercises.service';
import { CreateDayExerciseDto } from './dto/create-day-exercise.dto';
import { UpdateDayExerciseDto } from './dto/update-day-exercise.dto';
import { ReorderDayExercisesDto } from './dto/reorder-day-exercises.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@UseGuards(JwtAuthGuard)
@Controller('programs/:programId/days/:dayId/exercises')
export class DayExercisesController {
  constructor(private readonly dayExercisesService: DayExercisesService) {}

  @Post()
  create(
    @CurrentUserId() userId: number,
    @Param('programId', ParseIntPipe) programId: number,
    @Param('dayId', ParseIntPipe) dayId: number,
    @Body() dto: CreateDayExerciseDto,
  ) {
    return this.dayExercisesService.create(userId, programId, dayId, dto);
  }

  @Get()
  findAll(
    @CurrentUserId() userId: number,
    @Param('programId', ParseIntPipe) programId: number,
    @Param('dayId', ParseIntPipe) dayId: number,
  ) {
    return this.dayExercisesService.findAll(userId, programId, dayId);
  }

  @Get(':dayExerciseId')
  findOne(
    @CurrentUserId() userId: number,
    @Param('programId', ParseIntPipe) programId: number,
    @Param('dayId', ParseIntPipe) dayId: number,
    @Param('dayExerciseId', ParseIntPipe) dayExerciseId: number,
  ) {
    return this.dayExercisesService.findOne(
      userId,
      programId,
      dayId,
      dayExerciseId,
    );
  }

  @Patch(':dayExerciseId')
  update(
    @CurrentUserId() userId: number,
    @Param('programId', ParseIntPipe) programId: number,
    @Param('dayId', ParseIntPipe) dayId: number,
    @Param('dayExerciseId', ParseIntPipe) dayExerciseId: number,
    @Body() dto: UpdateDayExerciseDto,
  ) {
    return this.dayExercisesService.update(
      userId,
      programId,
      dayId,
      dayExerciseId,
      dto,
    );
  }

  @Post('reorder')
  reorder(
    @CurrentUserId() userId: number,
    @Param('programId', ParseIntPipe) programId: number,
    @Param('dayId', ParseIntPipe) dayId: number,
    @Body() dto: ReorderDayExercisesDto,
  ) {
    return this.dayExercisesService.reorder(userId, programId, dayId, dto);
  }

  @Delete(':dayExerciseId')
  async remove(
    @CurrentUserId() userId: number,
    @Param('programId', ParseIntPipe) programId: number,
    @Param('dayId', ParseIntPipe) dayId: number,
    @Param('dayExerciseId', ParseIntPipe) dayExerciseId: number,
  ) {
    await this.dayExercisesService.remove(
      userId,
      programId,
      dayId,
      dayExerciseId,
    );
    return { ok: true };
  }
}
