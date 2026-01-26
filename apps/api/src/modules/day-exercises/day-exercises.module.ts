import { Module } from '@nestjs/common';
import { DayExercisesController } from './day-exercises.controller';
import { DayExercisesService } from './day-exercises.service';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [DayExercisesController],
  providers: [DayExercisesService],
})
export class DayExercisesModule {}