import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, ProgramDay } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateProgramDayDto } from './dto/create-program-day.dto';
import { UpdateProgramDayDto } from './dto/update-program-day.dto';

@Injectable()
export class ProgramDaysService {
  constructor(private readonly prisma: PrismaService) {}

  private async ensureProgramExists(programId: number): Promise<void> {
    const exists = await this.prisma.program.findUnique({
      where: { id: programId },
      select: { id: true },
    });
    if (!exists) throw new NotFoundException('Program not found');
  }

  async create(programId: number, dto: CreateProgramDayDto): Promise<ProgramDay> {
    await this.ensureProgramExists(programId);

    try {
      return await this.prisma.programDay.create({
        data: {
          name: dto.name,
          order: dto.order,
          programId,
        },
      });
    } catch (e) {
      // Unique constraint on (programId, order)
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
        throw new ConflictException('Day order already exists for this program');
      }
      throw e;
    }
  }

  async findAll(programId: number): Promise<ProgramDay[]> {
    await this.ensureProgramExists(programId);

    return this.prisma.programDay.findMany({
      where: { programId },
      orderBy: { order: 'asc' },
    });
  }

  async findOne(programId: number, dayId: number): Promise<ProgramDay> {
    await this.ensureProgramExists(programId);

    const day = await this.prisma.programDay.findFirst({
      where: { id: dayId, programId },
    });

    if (!day) throw new NotFoundException('Program day not found');
    return day;
  }

  async update(
    programId: number,
    dayId: number,
    dto: UpdateProgramDayDto,
  ): Promise<ProgramDay> {
    await this.ensureProgramExists(programId);

    // Ensure ownership
    await this.findOne(programId, dayId);

    try {
      return await this.prisma.programDay.update({
        where: { id: dayId },
        data: dto,
      });
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
        throw new ConflictException('Day order already exists for this program');
      }
      throw e;
    }
  }

  async remove(programId: number, dayId: number): Promise<void> {
    await this.ensureProgramExists(programId);

    // Ensure ownership
    await this.findOne(programId, dayId);

    await this.prisma.programDay.delete({ where: { id: dayId } });
  }
}