import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Exercise, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateExerciseDto } from './dto/create-exercise.dto';
import { UpdateExerciseDto } from './dto/update-exercise.dto';

@Injectable()
export class ExercisesService {
  constructor(private readonly prisma: PrismaService) {}

  private normalizeName(name: string): string {
    return name.trim();
  }

  async create(dto: CreateExerciseDto): Promise<Exercise> {
    const name = this.normalizeName(dto.name);

    try {
      return await this.prisma.exercise.create({
        data: { name },
      });
    } catch (e) {
      if (
        e instanceof Prisma.PrismaClientKnownRequestError &&
        e.code === 'P2002'
      ) {
        throw new ConflictException('Exercise with this name already exists');
      }
      throw e;
    }
  }

  async findAll(): Promise<Exercise[]> {
    return this.prisma.exercise.findMany({
      orderBy: { name: 'asc' },
    });
  }

  async findOne(id: number): Promise<Exercise> {
    const exercise = await this.prisma.exercise.findUnique({
      where: { id },
    });
    if (!exercise) throw new NotFoundException('Exercise not found');
    return exercise;
  }

  async update(
    id: number,
    dto: UpdateExerciseDto,
  ): Promise<Exercise> {
    await this.findOne(id);

    try {
      return await this.prisma.exercise.update({
        where: { id },
        data: dto.name
          ? { name: this.normalizeName(dto.name) }
          : {},
      });
    } catch (e) {
      if (
        e instanceof Prisma.PrismaClientKnownRequestError &&
        e.code === 'P2002'
      ) {
        throw new ConflictException('Exercise with this name already exists');
      }
      throw e;
    }
  }

  async remove(id: number): Promise<void> {
    await this.findOne(id);
    await this.prisma.exercise.delete({ where: { id } });
  }
}