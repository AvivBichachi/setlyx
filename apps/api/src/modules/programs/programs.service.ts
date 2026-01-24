import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, Program } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateProgramDto } from './dto/create-program.dto';
import { UpdateProgramDto } from './dto/update-program.dto';

@Injectable()
export class ProgramsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreateProgramDto): Promise<Program> {
    return this.prisma.program.create({ data: dto });
  }

  async findAll(): Promise<Program[]> {
    return this.prisma.program.findMany({
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(id: number): Promise<Program> {
    const program = await this.prisma.program.findUnique({ where: { id } });
    if (!program) throw new NotFoundException('Program not found');
    return program;
  }

  async update(id: number, dto: UpdateProgramDto): Promise<Program> {
    try {
      return await this.prisma.program.update({
        where: { id },
        data: dto,
      });
    } catch (e) {
      // Prisma throws P2025 when record not found on update/delete
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2025') {
        throw new NotFoundException('Program not found');
      }
      throw e;
    }
  }

  async remove(id: number): Promise<void> {
    try {
      await this.prisma.program.delete({ where: { id } });
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2025') {
        throw new NotFoundException('Program not found');
      }
      throw e;
    }
  }
}