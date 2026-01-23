import { Module } from '@nestjs/common';
import { HealthModule } from './modules/health/health.module';
import { PrismaModule } from './modules/prisma/prisma.module';


@Module({
  imports: [HealthModule, PrismaModule],
})
export class AppModule {}
