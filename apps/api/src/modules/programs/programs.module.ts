import { Module } from '@nestjs/common';
import { ProgramsController } from './programs.controller';
import { ProgramsService } from './programs.service';
import { PrismaModule } from '../prisma/prisma.module'

@Module({
  imports: [
    PrismaModule,
  ],
  controllers: [ProgramsController],
  providers: [ProgramsService]
})
export class ProgramsModule {}
