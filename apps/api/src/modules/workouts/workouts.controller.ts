import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { WorkoutsService } from './workouts.service';
import { StartWorkoutSessionDto } from './dto/start-workout-session.dto';
import { CreateWorkoutSetDto } from './dto/create-workout-set.dto';
import { GetSetDefaultsQueryDto } from './dto/get-set-defaults.query.dto';
import { CurrentUserId } from '../../common/current-user-id.decorator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@UseGuards(JwtAuthGuard)
@Controller('workouts/sessions')
export class WorkoutsController {
  constructor(private readonly workoutsService: WorkoutsService) { }

  @Get()
  findAll(@CurrentUserId() userId: number) {
    return this.workoutsService.findAll(userId);
  }

  @Get('active')
  async getActiveSession(@CurrentUserId() userId: number) {
    const session = await this.workoutsService.getActiveSession(userId);
    return { session: session ?? null };
  }

    @Get('last')
  async getLastCompletedSession(@CurrentUserId() userId: number) {
    const session = await this.workoutsService.getLastCompletedSession(userId);
    return { session: session ?? null };
  }


  @Post('start')
  start(@CurrentUserId() userId: number, @Body() dto: StartWorkoutSessionDto) {
    return this.workoutsService.start(userId, dto);
  }

  @Get(':sessionId')
  getSession(
    @CurrentUserId() userId: number,
    @Param('sessionId', ParseIntPipe) sessionId: number,
  ) {
    return this.workoutsService.getSession(userId, sessionId);
  }

  @Get(':sessionId/details')
  findOneDetailed(
    @CurrentUserId() userId: number,
    @Param('sessionId', ParseIntPipe) sessionId: number,
  ) {
    return this.workoutsService.findOneDetailed(userId, sessionId);
  }

  @Get(':sessionId/sets/defaults')
  getSetDefaults(
    @CurrentUserId() userId: number,
    @Param('sessionId', ParseIntPipe) sessionId: number,
    @Query() query: GetSetDefaultsQueryDto,
  ) {
    return this.workoutsService.getSetDefaults(userId, sessionId, query.dayExerciseId);
  }

  @Post(':sessionId/sets')
  addSet(
    @CurrentUserId() userId: number,
    @Param('sessionId', ParseIntPipe) sessionId: number,
    @Body() dto: CreateWorkoutSetDto,
  ) {
    return this.workoutsService.addSet(userId, sessionId, dto);
  }

  // ✅ change PATCH -> POST (action endpoint)
  @Post(':sessionId/finish')
  finish(
    @CurrentUserId() userId: number,
    @Param('sessionId', ParseIntPipe) sessionId: number,
  ) {
    return this.workoutsService.finish(userId, sessionId);
  }

  @Get(':sessionId/summary')
  getSummary(
    @CurrentUserId() userId: number,
    @Param('sessionId', ParseIntPipe) sessionId: number,
  ) {
    return this.workoutsService.getSummary(userId, sessionId);
  }
}