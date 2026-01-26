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
import { ExercisesService } from './exercises.service';
import { CreateExerciseDto } from './dto/create-exercise.dto';
import { UpdateExerciseDto } from './dto/update-exercise.dto';

@Controller('exercises')
export class ExercisesController {
  constructor(private readonly exercisesService: ExercisesService) {}

  @Post()
  create(@Body() dto: CreateExerciseDto) {
    return this.exercisesService.create(dto);
  }

  @Get()
  findAll() {
    return this.exercisesService.findAll();
  }

  @Get(':exerciseId')
  findOne(@Param('exerciseId', ParseIntPipe) id: number) {
    return this.exercisesService.findOne(id);
  }

  @Patch(':exerciseId')
  update(
    @Param('exerciseId', ParseIntPipe) id: number,
    @Body() dto: UpdateExerciseDto,
  ) {
    return this.exercisesService.update(id, dto);
  }

  @Delete(':exerciseId')
  async remove(@Param('exerciseId', ParseIntPipe) id: number) {
    await this.exercisesService.remove(id);
    return { ok: true };
  }
}