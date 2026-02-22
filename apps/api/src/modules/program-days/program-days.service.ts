import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, ProgramDay } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateProgramDayDto } from './dto/create-program-day.dto';
import { UpdateProgramDayDto } from './dto/update-program-day.dto';
import { ReorderProgramDaysDto } from './dto/reorder-program-days.dto';

@Injectable()
export class ProgramDaysService {
  constructor(private readonly prisma: PrismaService) {}

  private readonly programDayOwnershipWhere = (userId: number, programId: number) => ({
    programId,
    program: { userId },
  });

  private async normalizeDayOrders(
    tx: Prisma.TransactionClient,
    userId: number,
    programId: number,
  ): Promise<void> {
    const rows = await tx.programDay.findMany({
      where: this.programDayOwnershipWhere(userId, programId),
      select: { id: true },
      orderBy: [{ order: 'asc' }, { id: 'asc' }],
    });

    for (let index = 0; index < rows.length; index += 1) {
      const expectedOrder = index + 1;
      await tx.programDay.update({
        where: { id: rows[index].id },
        data: { order: expectedOrder },
      });
    }
  }

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
      where: this.programDayOwnershipWhere(userId, programId),
      orderBy: { order: 'asc' },
    });
  }

  async findOne(userId: number, programId: number, dayId: number): Promise<ProgramDay> {
    await this.ensureProgramOwnership(userId, programId);

    const day = await this.prisma.programDay.findFirst({
      where: { id: dayId, ...this.programDayOwnershipWhere(userId, programId) },
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
        where: { id: dayId, ...this.programDayOwnershipWhere(userId, programId) },
        data,
      });

      if (res.count === 0) throw new NotFoundException('Program day not found');

      // return updated row
      const updated = await this.prisma.programDay.findFirst({
        where: { id: dayId, ...this.programDayOwnershipWhere(userId, programId) },
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

  async reorder(userId: number, programId: number, dto: ReorderProgramDaysDto): Promise<ProgramDay[]> {
    await this.ensureProgramOwnership(userId, programId);

    const existingDays = await this.prisma.programDay.findMany({
      where: this.programDayOwnershipWhere(userId, programId),
      select: { id: true },
      orderBy: { order: 'asc' },
    });

    if (existingDays.length !== dto.items.length) {
      throw new BadRequestException('Reorder payload must include all program days exactly once');
    }

    const existingIds = new Set(existingDays.map((d) => d.id));
    const itemIds = dto.items.map((item) => item.id);
    const uniqueItemIds = new Set(itemIds);

    if (uniqueItemIds.size !== dto.items.length) {
      throw new BadRequestException('Program day ids must be unique');
    }

    for (const id of uniqueItemIds) {
      if (!existingIds.has(id)) {
        throw new BadRequestException('Reorder payload contains day ids outside the program');
      }
    }

    const uniqueOrders = new Set(dto.items.map((item) => item.order));
    if (uniqueOrders.size !== dto.items.length) {
      throw new BadRequestException('Program day orders must be unique');
    }

    const sortedOrders = [...uniqueOrders].sort((a, b) => a - b);
    for (let index = 0; index < sortedOrders.length; index += 1) {
      if (sortedOrders[index] !== index + 1) {
        throw new BadRequestException('Program day orders must be contiguous and start at 1');
      }
    }

    await this.prisma.$transaction(async (tx) => {
      const tempOffset = dto.items.length + 1000;

      for (const item of dto.items) {
        await tx.programDay.updateMany({
          where: { id: item.id, ...this.programDayOwnershipWhere(userId, programId) },
          data: { order: item.order + tempOffset },
        });
      }

      for (const item of dto.items) {
        await tx.programDay.updateMany({
          where: { id: item.id, ...this.programDayOwnershipWhere(userId, programId) },
          data: { order: item.order },
        });
      }
    });

    return this.findAll(userId, programId);
  }

  async remove(userId: number, programId: number, dayId: number): Promise<void> {
    await this.ensureProgramOwnership(userId, programId);

    try {
      await this.prisma.$transaction(async (tx) => {
        const res = await tx.programDay.deleteMany({
          where: { id: dayId, ...this.programDayOwnershipWhere(userId, programId) },
        });

        if (res.count === 0) throw new NotFoundException('Program day not found');

        await this.normalizeDayOrders(tx, userId, programId);
      });
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2003') {
        throw new ConflictException(
          'Cannot delete a program day that has linked exercises or workout history',
        );
      }
      throw e;
    }
  }
}
