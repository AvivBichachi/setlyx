import { Module } from '@nestjs/common';
import { ProgramDaysController } from './program-days.controller';
import { ProgramDaysService } from './program-days.service';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [ProgramDaysController],
  providers: [ProgramDaysService],
})
export class ProgramDaysModule {}