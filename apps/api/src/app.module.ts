import { Module } from '@nestjs/common';
import { HealthModule } from './modules/health/health.module';
import { PrismaModule } from './modules/prisma/prisma.module';
import { ProgramsModule } from './modules/programs/programs.module';


@Module({
  imports: [HealthModule, PrismaModule, ProgramsModule],
})
export class AppModule {}
