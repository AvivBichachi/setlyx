import { Module } from '@nestjs/common';
import { HealthModule } from './modules/health/health.module';
import { PrismaModule } from './modules/prisma/prisma.module';
import { ProgramsModule } from './modules/programs/programs.module';
import { ProgramDaysModule } from './modules/program-days/program-days.module';
import { DayExercisesModule } from './modules/day-exercises/day-exercises.module';


@Module({
  imports: [HealthModule, PrismaModule, ProgramsModule, ProgramDaysModule, DayExercisesModule],
})
export class AppModule {}
