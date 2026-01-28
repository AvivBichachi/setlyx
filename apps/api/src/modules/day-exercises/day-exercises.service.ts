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

  private async ensureDayOwnership(userId: number, programId: number, dayId: number) {
    // מאמתים גם programId וגם dayId וגם שהכל שייך ל-user
    const day = await this.prisma.programDay.findFirst({
      where: {
        id: dayId,
        programId,
        program: { userId },
      },
      select: { id: true },
    });

    if (!day) throw new NotFoundException('Program day not found');
  }

  private async ensureExerciseVisibleToUser(userId: number, exerciseId: number) {
    // בינתיים: אם עוד לא הוספת exercise.userId, תשאיר findUnique רגיל.
    // אחרי שתוסיף userId nullable, מחליפים את זה ל:
    // where: { id: exerciseId, OR: [{ userId: null }, { userId }] }
    const ex = await this.prisma.exercise.findUnique({
      where: { id: exerciseId },
      select: { id: true },
    });
    if (!ex) throw new NotFoundException('Exercise not found');
  }

  async create(
    userId: number,
    programId: number,
    dayId: number,
    dto: CreateDayExerciseDto,
  ): Promise<DayExercise> {
    await this.ensureDayOwnership(userId, programId, dayId);
    this.validateRepRange(dto.minReps, dto.maxReps);

    await this.ensureExerciseVisibleToUser(userId, dto.exerciseId);

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

  async findAll(userId: number, programId: number, dayId: number): Promise<DayExercise[]> {
    await this.ensureDayOwnership(userId, programId, dayId);

    return this.prisma.dayExercise.findMany({
      where: {
        programDayId: dayId,
        programDay: { program: { userId } },
      },
      orderBy: { order: 'asc' },
    });
  }

  async findOne(
    userId: number,
    programId: number,
    dayId: number,
    dayExerciseId: number,
  ): Promise<DayExercise> {
    await this.ensureDayOwnership(userId, programId, dayId);

    const de = await this.prisma.dayExercise.findFirst({
      where: {
        id: dayExerciseId,
        programDayId: dayId,
        programDay: { program: { userId } },
      },
    });

    if (!de) throw new NotFoundException('Day exercise not found');
    return de;
  }

  async update(
    userId: number,
    programId: number,
    dayId: number,
    dayExerciseId: number,
    dto: UpdateDayExerciseDto,
  ): Promise<DayExercise> {
    await this.ensureDayOwnership(userId, programId, dayId);
    this.validateRepRange(dto.minReps, dto.maxReps);

    const data: Prisma.DayExerciseUpdateManyMutationInput = {
      ...(dto.order !== undefined ? { order: dto.order } : {}),
      ...(dto.targetSets !== undefined ? { targetSets: dto.targetSets } : {}),
      ...(dto.minReps !== undefined ? { minReps: dto.minReps } : {}),
      ...(dto.maxReps !== undefined ? { maxReps: dto.maxReps } : {}),
    };

    try {
      const res = await this.prisma.dayExercise.updateMany({
        where: {
          id: dayExerciseId,
          programDayId: dayId,
          programDay: { program: { userId } },
        },
        data,
      });

      if (res.count === 0) throw new NotFoundException('Day exercise not found');

      const updated = await this.prisma.dayExercise.findFirst({
        where: {
          id: dayExerciseId,
          programDayId: dayId,
          programDay: { program: { userId } },
        },
      });

      if (!updated) throw new NotFoundException('Day exercise not found');
      return updated;
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
        throw new ConflictException('Exercise order already exists for this day');
      }
      throw e;
    }
  }

  async remove(
    userId: number,
    programId: number,
    dayId: number,
    dayExerciseId: number,
  ): Promise<void> {
    await this.ensureDayOwnership(userId, programId, dayId);

    const res = await this.prisma.dayExercise.deleteMany({
      where: {
        id: dayExerciseId,
        programDayId: dayId,
        programDay: { program: { userId } },
      },
    });

    if (res.count === 0) throw new NotFoundException('Day exercise not found');
  }
}