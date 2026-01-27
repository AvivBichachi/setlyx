import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
} from '@nestjs/common';
import { WorkoutsService } from './workouts.service';
import { StartWorkoutSessionDto } from './dto/start-workout-session.dto';
import { CreateWorkoutSetDto } from './dto/create-workout-set.dto';

@Controller('workouts/sessions')
export class WorkoutsController {
  constructor(private readonly workoutsService: WorkoutsService) { }

  @Get()
  findAll() {
    return this.workoutsService.findAll();
  }

  @Post('start')
  start(@Body() dto: StartWorkoutSessionDto) {
    return this.workoutsService.start(dto);
  }

  @Get(':sessionId')
  getSession(@Param('sessionId', ParseIntPipe) sessionId: number) {
    return this.workoutsService.getSession(sessionId);
  }

  @Get(':sessionId/details')
  findOneDetailed(
    @Param('sessionId', ParseIntPipe) sessionId: number,
  ) {
    return this.workoutsService.findOneDetailed(sessionId);
  }

  @Post(':sessionId/sets')
  addSet(
    @Param('sessionId', ParseIntPipe) sessionId: number,
    @Body() dto: CreateWorkoutSetDto,
  ) {
    return this.workoutsService.addSet(sessionId, dto);
  }

  @Patch(':sessionId/finish')
  finish(@Param('sessionId', ParseIntPipe) sessionId: number) {
    return this.workoutsService.finish(sessionId);
  }

  @Get(':sessionId/summary')
  getSummary(@Param('sessionId', ParseIntPipe) sessionId: number) {
    return this.workoutsService.getSummary(sessionId);
  }
}