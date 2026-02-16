import {
  ConflictException,
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { Exercise, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateExerciseDto } from './dto/create-exercise.dto';
import { UpdateExerciseDto } from './dto/update-exercise.dto';

type ProgressQuery = {
  limit?: string;
  cursor?: string;
  from?: string;
  to?: string;
};

@Injectable()
export class ExercisesService {
  constructor(private readonly prisma: PrismaService) { }

  private normalizeName(name: string): string {
    return name.trim();
  }

  async create(dto: CreateExerciseDto): Promise<Exercise> {
    const name = this.normalizeName(dto.name);
    const primaryMuscle = dto.primaryMuscle;


    try {
      return await this.prisma.exercise.create({
        data: { name, primaryMuscle },
      });
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
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

  async update(id: number, dto: UpdateExerciseDto): Promise<Exercise> {
    await this.findOne(id);

    if (!dto.name) {
      throw new BadRequestException('Nothing to update');
    }

    const name = this.normalizeName(dto.name);

    try {
      return await this.prisma.exercise.update({
        where: { id },
        data: { name },
      });
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
        throw new ConflictException('Exercise with this name already exists');
      }
      throw e;
    }
  }


  async remove(id: number): Promise<void> {
    await this.findOne(id);
    await this.prisma.exercise.delete({ where: { id } });
  }

  async getProgress(exerciseId: number, q: ProgressQuery) {
    // 1) validate exercise exists
    const exercise = await this.prisma.exercise.findUnique({
      where: { id: exerciseId },
      select: { id: true, name: true, primaryMuscle: true },
    });
    if (!exercise) throw new NotFoundException('Exercise not found');

    // 2) parse query params
    const takeRaw = q.limit ? Number(q.limit) : 100;
    if (!Number.isFinite(takeRaw) || takeRaw <= 0) {
      throw new BadRequestException('limit must be a positive number');
    }
    const take = Math.min(takeRaw, 500);

    let cursorId: number | undefined;
    if (q.cursor !== undefined) {
      const parsed = Number(q.cursor);
      if (!Number.isInteger(parsed) || parsed <= 0) {
        throw new BadRequestException('cursor must be a positive integer');
      }
      cursorId = parsed;
    }

    const fromDate = q.from ? new Date(q.from) : undefined;
    if (q.from && Number.isNaN(fromDate!.getTime())) {
      throw new BadRequestException('from must be a valid ISO date');
    }

    const toDate = q.to ? new Date(q.to) : undefined;
    if (q.to && Number.isNaN(toDate!.getTime())) {
      throw new BadRequestException('to must be a valid ISO date');
    }

    // 3) build where for HISTORY (paged)
    const whereHistory: Prisma.WorkoutSetWhereInput = {
      dayExercise: { exerciseId },
    };

    if (fromDate || toDate) {
      whereHistory.createdAt = {};
      if (fromDate) whereHistory.createdAt.gte = fromDate;
      if (toDate) whereHistory.createdAt.lte = toDate;
    }

    // Cursor pagination: id < cursor (descending by id)
    if (cursorId) {
      whereHistory.id = { lt: cursorId };
    }

    // 4) query sets for history (paged)
    const sets = await this.prisma.workoutSet.findMany({
      where: whereHistory,
      take,
      orderBy: [{ id: 'desc' }], // stable pagination by id
      select: {
        id: true,
        reps: true,
        weight: true,
        createdAt: true,
        sessionId: true,
        session: {
          select: {
            id: true,
            program: { select: { id: true, name: true, type: true } },
            programDay: { select: { id: true, name: true, order: true } },
          },
        },
      },
    });

    const history = sets.map((s) => {
      const volume = s.reps * s.weight;
      return {
        performedAt: s.createdAt,
        weight: s.weight,
        reps: s.reps,
        volume,
        sessionId: s.sessionId,
        program: s.session.program,
        programDay: s.session.programDay,
      };
    });

    const nextCursor = sets.length === take ? sets[sets.length - 1].id : null;

    // 5) PRs: all-time (NOT affected by limit/cursor/from/to)
    const prWhere: Prisma.WorkoutSetWhereInput = {
      dayExercise: { exerciseId },
    };

    // best weight set: highest weight, tie: reps desc, then newest
    const bestWeightRow = await this.prisma.workoutSet.findFirst({
      where: prWhere,
      orderBy: [{ weight: 'desc' }, { reps: 'desc' }, { createdAt: 'desc' }],
      select: { weight: true, reps: true, createdAt: true, sessionId: true },
    });

    const bestWeightSet = bestWeightRow
      ? {
        weight: bestWeightRow.weight,
        reps: bestWeightRow.reps,
        performedAt: bestWeightRow.createdAt,
        sessionId: bestWeightRow.sessionId,
      }
      : null;

    // best volume set: compute exact max(reps * weight) in TS
    // (small select to keep it light)
    const allTimeRows = await this.prisma.workoutSet.findMany({
      where: prWhere,
      select: { weight: true, reps: true, createdAt: true, sessionId: true },
    });

    let bestVolumeSet: {
      weight: number;
      reps: number;
      volume: number;
      performedAt: Date;
      sessionId: number;
    } | null = null;

    for (const r of allTimeRows) {
      const volume = r.weight * r.reps;

      if (
        !bestVolumeSet ||
        volume > bestVolumeSet.volume ||
        (volume === bestVolumeSet.volume && r.weight > bestVolumeSet.weight) ||
        (volume === bestVolumeSet.volume &&
          r.weight === bestVolumeSet.weight &&
          r.reps > bestVolumeSet.reps) ||
        (volume === bestVolumeSet.volume &&
          r.weight === bestVolumeSet.weight &&
          r.reps === bestVolumeSet.reps &&
          r.createdAt > bestVolumeSet.performedAt)
      ) {
        bestVolumeSet = {
          weight: r.weight,
          reps: r.reps,
          volume,
          performedAt: r.createdAt,
          sessionId: r.sessionId,
        };
      }
    }

    return {
      exercise,
      prs: {
        bestWeightSet,
        bestVolumeSet,
      },
      history,
      nextCursor,
    };
  }
}