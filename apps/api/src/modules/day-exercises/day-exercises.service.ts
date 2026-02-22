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
import { ReorderDayExercisesDto } from './dto/reorder-day-exercises.dto';

@Injectable()
export class DayExercisesService {
  constructor(private readonly prisma: PrismaService) {}

  private readonly dayOwnershipWhere = (
    userId: number,
    programId: number,
    dayId: number,
  ) => ({
    programDayId: dayId,
    programDay: { programId, program: { userId } },
  });

  private validateRepRange(minReps?: number, maxReps?: number) {
    if (minReps !== undefined && maxReps !== undefined && minReps > maxReps) {
      throw new BadRequestException('minReps must be <= maxReps');
    }
  }

  private async ensureDayOwnership(
    userId: number,
    programId: number,
    dayId: number,
  ) {
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

  private async ensureExerciseVisibleToUser(
    userId: number,
    exerciseId: number,
  ) {
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
      if (
        e instanceof Prisma.PrismaClientKnownRequestError &&
        e.code === 'P2002'
      ) {
        throw new ConflictException(
          'Exercise order already exists for this day',
        );
      }
      throw e;
    }
  }

  async findAll(
    userId: number,
    programId: number,
    dayId: number,
  ): Promise<DayExercise[]> {
    await this.ensureDayOwnership(userId, programId, dayId);

    return this.prisma.dayExercise.findMany({
      where: this.dayOwnershipWhere(userId, programId, dayId),
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
        ...this.dayOwnershipWhere(userId, programId, dayId),
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
          ...this.dayOwnershipWhere(userId, programId, dayId),
        },
        data,
      });

      if (res.count === 0)
        throw new NotFoundException('Day exercise not found');

      const updated = await this.prisma.dayExercise.findFirst({
        where: {
          id: dayExerciseId,
          ...this.dayOwnershipWhere(userId, programId, dayId),
        },
      });

      if (!updated) throw new NotFoundException('Day exercise not found');
      return updated;
    } catch (e) {
      if (
        e instanceof Prisma.PrismaClientKnownRequestError &&
        e.code === 'P2002'
      ) {
        throw new ConflictException(
          'Exercise order already exists for this day',
        );
      }
      throw e;
    }
  }

  async reorder(
    userId: number,
    programId: number,
    dayId: number,
    dto: ReorderDayExercisesDto,
  ): Promise<DayExercise[]> {
    await this.ensureDayOwnership(userId, programId, dayId);

    const existingRows = await this.prisma.dayExercise.findMany({
      where: this.dayOwnershipWhere(userId, programId, dayId),
      select: { id: true },
      orderBy: { order: 'asc' },
    });

    if (existingRows.length !== dto.items.length) {
      throw new BadRequestException(
        'Reorder payload must include all day exercises exactly once',
      );
    }

    const existingIds = new Set(existingRows.map((row) => row.id));
    const uniqueItemIds = new Set(dto.items.map((item) => item.id));
    if (uniqueItemIds.size !== dto.items.length) {
      throw new BadRequestException('Day exercise ids must be unique');
    }
    for (const id of uniqueItemIds) {
      if (!existingIds.has(id)) {
        throw new BadRequestException(
          'Reorder payload contains ids outside the day',
        );
      }
    }

    const uniqueOrders = new Set(dto.items.map((item) => item.order));
    if (uniqueOrders.size !== dto.items.length) {
      throw new BadRequestException('Day exercise orders must be unique');
    }
    const sortedOrders = [...uniqueOrders].sort((a, b) => a - b);
    for (let index = 0; index < sortedOrders.length; index += 1) {
      if (sortedOrders[index] !== index + 1) {
        throw new BadRequestException(
          'Day exercise orders must be contiguous and start at 1',
        );
      }
    }

    await this.prisma.$transaction(async (tx) => {
      const tempOffset = dto.items.length + 1000;

      for (const item of dto.items) {
        await tx.dayExercise.updateMany({
          where: {
            id: item.id,
            ...this.dayOwnershipWhere(userId, programId, dayId),
          },
          data: { order: item.order + tempOffset },
        });
      }

      for (const item of dto.items) {
        await tx.dayExercise.updateMany({
          where: {
            id: item.id,
            ...this.dayOwnershipWhere(userId, programId, dayId),
          },
          data: { order: item.order },
        });
      }
    });

    return this.findAll(userId, programId, dayId);
  }

  async remove(
    userId: number,
    programId: number,
    dayId: number,
    dayExerciseId: number,
  ): Promise<void> {
    await this.ensureDayOwnership(userId, programId, dayId);
    await this.prisma.$transaction(async (tx) => {
      const res = await tx.dayExercise.deleteMany({
        where: {
          id: dayExerciseId,
          ...this.dayOwnershipWhere(userId, programId, dayId),
        },
      });

      if (res.count === 0)
        throw new NotFoundException('Day exercise not found');

      const remainingRows = await tx.dayExercise.findMany({
        where: this.dayOwnershipWhere(userId, programId, dayId),
        select: { id: true },
        orderBy: [{ order: 'asc' }, { id: 'asc' }],
      });

      for (let index = 0; index < remainingRows.length; index += 1) {
        await tx.dayExercise.update({
          where: { id: remainingRows[index].id },
          data: { order: index + 1 },
        });
      }
    });
  }
}
