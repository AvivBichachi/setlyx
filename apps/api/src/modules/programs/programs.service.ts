import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateProgramDto } from './dto/create-program.dto';
import { UpdateProgramDto } from './dto/update-program.dto';

@Injectable()
export class ProgramsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(userId: number, dto: CreateProgramDto) {
    return this.prisma.program.create({
      data: {
        userId,
        name: dto.name,
        type: dto.type,
        isActive: dto.isActive ?? false,
      },
      select: {
        id: true,
        name: true,
        type: true,
        isActive: true,
        createdAt: true,
      },
    });
  }

  async findAll(userId: number) {
    return this.prisma.program.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      select: { id: true, name: true, type: true, isActive: true },
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
    // whitelist only (never allow userId ownership changes)
    const data: Prisma.ProgramUpdateManyMutationInput = {
      ...(dto.name !== undefined ? { name: dto.name } : {}),
      ...(dto.type !== undefined ? { type: dto.type } : {}),
      ...(dto.isActive !== undefined ? { isActive: dto.isActive } : {}),
    };

    const res = await this.prisma.program.updateMany({
      where: { id, userId },
      data,
    });

    if (res.count === 0) throw new NotFoundException('Program not found');

    // return a clean read shape (avoid leaking raw entity if you prefer)
    return this.prisma.program.findFirst({
      where: { id, userId },
      select: { id: true, name: true, type: true, isActive: true, createdAt: true, updatedAt: true },
    });
  }

  async remove(userId: number, id: number): Promise<void> {
    const res = await this.prisma.program.deleteMany({
      where: { id, userId },
    });

    if (res.count === 0) throw new NotFoundException('Program not found');
  }
}