import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateProgramDto } from './dto/create-program.dto';
import { UpdateProgramDto } from './dto/update-program.dto';

@Injectable()
export class ProgramsService {
  constructor(private readonly prisma: PrismaService) {}

  private readonly baseSelect = {
    id: true,
    name: true,
    type: true,
    isActive: true,
    createdAt: true,
    updatedAt: true,
  } as const;

  async create(userId: number, dto: CreateProgramDto) {
    const shouldBeActive = dto.isActive ?? false;

    return this.prisma.$transaction(async (tx) => {
      if (shouldBeActive) {
        await tx.program.updateMany({
          where: { userId, isActive: true },
          data: { isActive: false },
        });
      }

      return tx.program.create({
        data: {
          userId,
          name: dto.name,
          type: dto.type,
          isActive: shouldBeActive,
        },
        select: this.baseSelect,
      });
    });
  }

  async findAll(userId: number) {
    return this.prisma.program.findMany({
      where: { userId },
      orderBy: [{ isActive: 'desc' }, { createdAt: 'desc' }],
      select: {
        ...this.baseSelect,
        days: {
          orderBy: { order: 'asc' },
          select: {
            id: true,
            name: true,
            order: true,
          },
        },
      },
    });
  }

  async findOne(userId: number, id: number) {
    const program = await this.prisma.program.findFirst({
      where: { id, userId },
      select: {
        id: true,
        name: true,
        type: true,
        isActive: true,
        days: {
          orderBy: { order: 'asc' },
          select: { id: true, name: true, order: true },
        },
      },
    });

    if (!program) throw new NotFoundException('Program not found');
    return program;
  }

  async findOneDetailed(userId: number, id: number) {
    const program = await this.prisma.program.findFirst({
      where: { id, userId },
      include: {
        days: {
          orderBy: { order: 'asc' },
          include: {
            exercises: {
              orderBy: { order: 'asc' },
              include: {
                exercise: { select: { id: true, name: true } },
              },
            },
          },
        },
      },
    });

    if (!program) throw new NotFoundException('Program not found');
    return program;
  }

  async update(userId: number, id: number, dto: UpdateProgramDto) {
    const exists = await this.prisma.program.findFirst({
      where: { id, userId },
      select: { id: true },
    });

    if (!exists) throw new NotFoundException('Program not found');

    const data: Prisma.ProgramUpdateInput = {
      ...(dto.name !== undefined ? { name: dto.name } : {}),
      ...(dto.type !== undefined ? { type: dto.type } : {}),
      ...(dto.isActive !== undefined ? { isActive: dto.isActive } : {}),
    };

    return this.prisma.$transaction(async (tx) => {
      if (dto.isActive === true) {
        await tx.program.updateMany({
          where: { userId, isActive: true, id: { not: id } },
          data: { isActive: false },
        });
      }

      await tx.program.update({
        where: { id },
        data,
        select: { id: true },
      });

      return tx.program.findFirst({
        where: { id, userId },
        select: this.baseSelect,
      });
    });
  }

  async remove(userId: number, id: number): Promise<void> {
    const res = await this.prisma.program.deleteMany({
      where: { id, userId },
    });

    if (res.count === 0) throw new NotFoundException('Program not found');
  }
}

