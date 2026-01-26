import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { DayExercise, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateDayExerciseDto } from './dto/create-day-exercise.dto';
import { UpdateDayExerciseDto } from './dto/update-day-exercise.dto';

@Injectable()
export class DayExercisesService {
  constructor(private readonly prisma: PrismaService) {}

  private validateRepRange(minReps?: number, maxReps?: number) {
    if (minReps !== undefined && maxReps !== undefined && minReps > maxReps) {
      throw new BadRequestException('minReps must be <= maxReps');
    }
  }

  private async ensureProgramExists(programId: number) {
    const program = await this.prisma.program.findUnique({
      where: { id: programId },
      select: { id: true },
    });
    if (!program) throw new NotFoundException('Program not found');
  }

  private async ensureDayExists(programId: number, dayId: number) {
    await this.ensureProgramExists(programId);

    const day = await this.prisma.programDay.findFirst({
      where: { id: dayId, programId },
      select: { id: true },
    });

    if (!day) throw new NotFoundException('Program day not found');
  }

  async create(
    programId: number,
    dayId: number,
    dto: CreateDayExerciseDto,
  ): Promise<DayExercise> {
    await this.ensureDayExists(programId, dayId);
    this.validateRepRange(dto.minReps, dto.maxReps);

    const exercise = await this.prisma.exercise.findUnique({
      where: { id: dto.exerciseId },
      select: { id: true },
    });
    if (!exercise) throw new NotFoundException('Exercise not found');

    try {
      return await this.prisma.dayExercise.create({
        data: {
          programDayId: dayId,
          exerciseId: dto.exerciseId,
          order: dto.order,
          targetSets: dto.targetSets,
          minReps: dto.minReps,
          maxReps: dto.maxReps,
        },
      });
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
        throw new ConflictException('Exercise order already exists for this day');
      }
      throw e;
    }
  }

  async findAll(programId: number, dayId: number): Promise<DayExercise[]> {
    await this.ensureDayExists(programId, dayId);

    return this.prisma.dayExercise.findMany({
      where: { programDayId: dayId },
      orderBy: { order: 'asc' },
    });
  }

  async update(
    programId: number,
    dayId: number,
    dayExerciseId: number,
    dto: UpdateDayExerciseDto,
  ): Promise<DayExercise> {
    await this.ensureDayExists(programId, dayId);

    this.validateRepRange(dto.minReps, dto.maxReps);

    const existing = await this.prisma.dayExercise.findFirst({
      where: { id: dayExerciseId, programDayId: dayId },
    });
    if (!existing) throw new NotFoundException('Day exercise not found');

    if (dto.exerciseId !== undefined) {
      const exercise = await this.prisma.exercise.findUnique({
        where: { id: dto.exerciseId },
        select: { id: true },
      });
      if (!exercise) throw new NotFoundException('Exercise not found');
    }

    try {
      return await this.prisma.dayExercise.update({
        where: { id: dayExerciseId },
        data: dto,
      });
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
        throw new ConflictException('Exercise order already exists for this day');
      }
      throw e;
    }
  }

  async remove(programId: number, dayId: number, dayExerciseId: number): Promise<void> {
    await this.ensureDayExists(programId, dayId);

    const existing = await this.prisma.dayExercise.findFirst({
      where: { id: dayExerciseId, programDayId: dayId },
      select: { id: true },
    });
    if (!existing) throw new NotFoundException('Day exercise not found');

    await this.prisma.dayExercise.delete({ where: { id: dayExerciseId } });
  }
}