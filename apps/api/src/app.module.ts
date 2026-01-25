import { Module } from '@nestjs/common';
import { HealthModule } from './modules/health/health.module';
import { PrismaModule } from './modules/prisma/prisma.module';
import { ProgramsModule } from './modules/programs/programs.module';
import { ProgramDaysModule } from './modules/program-days/program-days.module';


@Module({
  imports: [HealthModule, PrismaModule, ProgramsModule, ProgramDaysModule],
})
export class AppModule {}
