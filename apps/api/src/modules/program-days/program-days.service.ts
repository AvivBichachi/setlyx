import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, ProgramDay } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateProgramDayDto } from './dto/create-program-day.dto';
import { UpdateProgramDayDto } from './dto/update-program-day.dto';

@Injectable()
export class ProgramDaysService {
  constructor(private readonly prisma: PrismaService) {}

  private async ensureProgramOwnership(userId: number, programId: number): Promise<void> {
    const program = await this.prisma.program.findFirst({
      where: { id: programId, userId },
      select: { id: true },
    });
    if (!program) throw new NotFoundException('Program not found');
  }

  async create(userId: number, programId: number, dto: CreateProgramDayDto): Promise<ProgramDay> {
    await this.ensureProgramOwnership(userId, programId);

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

  async findAll(userId: number, programId: number): Promise<ProgramDay[]> {
    // validate ownership and avoid leaking whether programId exists
    await this.ensureProgramOwnership(userId, programId);

    return this.prisma.programDay.findMany({
      where: {
        programId,
        program: { userId },
      },
      orderBy: { order: 'asc' },
    });
  }

  async findOne(userId: number, programId: number, dayId: number): Promise<ProgramDay> {
    await this.ensureProgramOwnership(userId, programId);

    const day = await this.prisma.programDay.findFirst({
      where: {
        id: dayId,
        programId,
        program: { userId },
      },
    });

    if (!day) throw new NotFoundException('Program day not found');
    return day;
  }

  async update(
    userId: number,
    programId: number,
    dayId: number,
    dto: UpdateProgramDayDto,
  ): Promise<ProgramDay> {
    await this.ensureProgramOwnership(userId, programId);

    // whitelist (avoid future over-posting)
    const data: Prisma.ProgramDayUpdateManyMutationInput = {
      ...(dto.name !== undefined ? { name: dto.name } : {}),
      ...(dto.order !== undefined ? { order: dto.order } : {}),
    };

    try {
      const res = await this.prisma.programDay.updateMany({
        where: {
          id: dayId,
          programId,
          program: { userId },
        },
        data,
      });

      if (res.count === 0) throw new NotFoundException('Program day not found');

      // return updated row
      const updated = await this.prisma.programDay.findFirst({
        where: {
          id: dayId,
          programId,
          program: { userId },
        },
      });

      if (!updated) throw new NotFoundException('Program day not found');
      return updated;
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
        throw new ConflictException('Day order already exists for this program');
      }
      throw e;
    }
  }

  async remove(userId: number, programId: number, dayId: number): Promise<void> {
    await this.ensureProgramOwnership(userId, programId);

    const res = await this.prisma.programDay.deleteMany({
      where: {
        id: dayId,
        programId,
        program: { userId },
      },
    });

    if (res.count === 0) throw new NotFoundException('Program day not found');
  }
}