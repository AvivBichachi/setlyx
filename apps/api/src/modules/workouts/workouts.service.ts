import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, WorkoutSet } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { StartWorkoutSessionDto } from './dto/start-workout-session.dto';
import { CreateWorkoutSetDto } from './dto/create-workout-set.dto';

@Injectable()
export class WorkoutsService {
  constructor(private readonly prisma: PrismaService) {}

  private async ensureProgramDayOwnership(programId: number, programDayId: number) {
    const day = await this.prisma.programDay.findFirst({
      where: { id: programDayId, programId },
      select: { id: true },
    });
    if (!day) throw new NotFoundException('Program day not found under program');
  }

  private async getSessionOr404(userId: number, sessionId: number) {
    const session = await this.prisma.workoutSession.findFirst({
      where: { id: sessionId, userId },
      select: {
        id: true,
        userId: true,
        programId: true,
        programDayId: true,
        endedAt: true,
        startedAt: true,
      },
    });
    if (!session) throw new NotFoundException('Workout session not found');
    return session;
  }

  async start(userId: number, dto: StartWorkoutSessionDto) {
    await this.ensureProgramDayOwnership(dto.programId, dto.programDayId);

    return this.prisma.workoutSession.create({
      data: {
        userId,
        programId: dto.programId,
        programDayId: dto.programDayId,
      },
    });
  }

  async getSession(userId: number, sessionId: number) {
    await this.getSessionOr404(userId, sessionId);

    // IMPORTANT: findUnique({id}) can't include userId filter, so use findFirst
    return this.prisma.workoutSession.findFirst({
      where: { id: sessionId, userId },
      include: {
        sets: {
          orderBy: [{ dayExerciseId: 'asc' }, { setNumber: 'asc' }],
          include: {
            dayExercise: {
              include: {
                exercise: { select: { id: true, name: true } },
              },
            },
          },
        },
      },
    });
  }

  async addSet(userId: number, sessionId: number, dto: CreateWorkoutSetDto): Promise<WorkoutSet> {
    const session = await this.getSessionOr404(userId, sessionId);
    if (session.endedAt) throw new ConflictException('Workout session already finished');

    const de = await this.prisma.dayExercise.findFirst({
      where: { id: dto.dayExerciseId, programDayId: session.programDayId },
      select: { id: true },
    });
    if (!de) throw new NotFoundException('Day exercise not found under session day');

    try {
      return await this.prisma.workoutSet.create({
        data: {
          sessionId,
          dayExerciseId: dto.dayExerciseId,
          setNumber: dto.setNumber,
          reps: dto.reps,
          weight: dto.weight,
        },
      });
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
        throw new ConflictException('Set number already exists for this exercise in this session');
      }
      throw e;
    }
  }

  async finish(userId: number, sessionId: number) {
    await this.getSessionOr404(userId, sessionId);

    return this.prisma.workoutSession.update({
      where: { id: sessionId },
      data: { endedAt: new Date() },
    });
  }

  async findAll(userId: number) {
    return this.prisma.workoutSession.findMany({
      where: { userId },
      orderBy: { startedAt: 'desc' },
      select: {
        id: true,
        startedAt: true,
        endedAt: true,
        program: { select: { id: true, name: true, type: true } },
        programDay: { select: { id: true, name: true, order: true } },
        _count: { select: { sets: true } },
      },
    });
  }

  async findOneDetailed(userId: number, sessionId: number) {
    // enforce ownership
    await this.getSessionOr404(userId, sessionId);

    const session = await this.prisma.workoutSession.findFirst({
      where: { id: sessionId, userId },
      include: {
        program: { select: { id: true, name: true, type: true } },
        programDay: { select: { id: true, name: true, order: true } },
      },
    });

    if (!session) throw new NotFoundException('Workout session not found');

    const plannedExercises = await this.prisma.dayExercise.findMany({
      where: { programDayId: session.programDayId },
      orderBy: { order: 'asc' },
      include: {
        exercise: { select: { id: true, name: true } },
      },
    });

    const performedSets = await this.prisma.workoutSet.findMany({
      where: { sessionId: session.id },
      orderBy: { setNumber: 'asc' },
    });

    const setsByDayExerciseId = new Map<
      number,
      { setNumber: number; reps: number; weight: number }[]
    >();

    for (const s of performedSets) {
      const arr = setsByDayExerciseId.get(s.dayExerciseId) ?? [];
      arr.push({ setNumber: s.setNumber, reps: s.reps, weight: s.weight });
      setsByDayExerciseId.set(s.dayExerciseId, arr);
    }

    const exercises = plannedExercises.map((de) => ({
      dayExercise: {
        id: de.id,
        order: de.order,
        targetSets: de.targetSets,
        minReps: de.minReps,
        maxReps: de.maxReps,
        exercise: de.exercise, // { id, name }
      },
      performedSets: setsByDayExerciseId.get(de.id) ?? [],
    }));

    return {
      id: session.id,
      startedAt: session.startedAt,
      endedAt: session.endedAt,
      program: session.program,
      programDay: session.programDay,
      exercises,
    };
  }

  async getSummary(userId: number, sessionId: number) {
    // enforce ownership
    await this.getSessionOr404(userId, sessionId);

    const session = await this.prisma.workoutSession.findFirst({
      where: { id: sessionId, userId },
      select: {
        id: true,
        startedAt: true,
        endedAt: true,
      },
    });

    if (!session) throw new NotFoundException('Workout session not found');

    const sets = await this.prisma.workoutSet.findMany({
      where: { sessionId },
      orderBy: [{ dayExerciseId: 'asc' }, { setNumber: 'asc' }],
      select: {
        id: true,
        setNumber: true,
        reps: true,
        weight: true,
        dayExerciseId: true,
        dayExercise: {
          select: {
            exercise: { select: { id: true, name: true } },
          },
        },
      },
    });

    const durationSeconds =
      session.endedAt
        ? Math.floor((session.endedAt.getTime() - session.startedAt.getTime()) / 1000)
        : null;

    let totalSets = 0;
    let totalReps = 0;
    let totalVolume = 0;

    type TopSet = { weight: number; reps: number };
    type ExerciseAgg = {
      exerciseId: number;
      name: string;
      sets: number;
      repsTotal: number;
      volume: number;
      topSet: TopSet | null;
    };

    const byExercise = new Map<number, ExerciseAgg>();

    for (const s of sets) {
      const ex = s.dayExercise.exercise;
      const volume = s.reps * s.weight;

      totalSets += 1;
      totalReps += s.reps;
      totalVolume += volume;

      const curr = byExercise.get(ex.id) ?? {
        exerciseId: ex.id,
        name: ex.name,
        sets: 0,
        repsTotal: 0,
        volume: 0,
        topSet: null,
      };

      curr.sets += 1;
      curr.repsTotal += s.reps;
      curr.volume += volume;

      if (
        curr.topSet === null ||
        s.weight > curr.topSet.weight ||
        (s.weight === curr.topSet.weight && s.reps > curr.topSet.reps)
      ) {
        curr.topSet = { weight: s.weight, reps: s.reps };
      }

      byExercise.set(ex.id, curr);
    }

    const exercises = Array.from(byExercise.values()).sort((a, b) => a.exerciseId - b.exerciseId);

    return {
      sessionId: session.id,
      startedAt: session.startedAt,
      endedAt: session.endedAt,
      durationSeconds,
      totals: {
        totalSets,
        totalReps,
        totalVolume,
      },
      exercises,
    };
  }

  async getSetDefaults(userId: number, sessionId: number, dayExerciseId: number) {
    const session = await this.getSessionOr404(userId, sessionId);

    const de = await this.prisma.dayExercise.findFirst({
      where: { id: dayExerciseId, programDayId: session.programDayId },
      select: { id: true, exerciseId: true },
    });

    if (!de) {
      throw new NotFoundException('Day exercise not found under session day');
    }

    const exerciseId = de.exerciseId;

    // 1) Suggested: top working set from most recent prior session FOR THIS USER
    const lastSessionWithExercise = await this.prisma.workoutSession.findFirst({
      where: {
        userId,
        id: { not: sessionId },
        sets: {
          some: {
            dayExercise: { exerciseId },
          },
        },
      },
      orderBy: [{ startedAt: 'desc' }, { id: 'desc' }],
      select: { id: true, startedAt: true },
    });

    let suggested: any = null;

    if (lastSessionWithExercise) {
      const topSet = await this.prisma.workoutSet.findFirst({
        where: {
          sessionId: lastSessionWithExercise.id,
          dayExercise: { exerciseId },
        },
        orderBy: [
          { weight: 'desc' },
          { reps: 'desc' },
          { setNumber: 'desc' },
          { id: 'desc' },
        ],
        select: { id: true, weight: true, reps: true },
      });

      if (topSet) {
        suggested = {
          weight: topSet.weight,
          reps: topSet.reps,
          source: 'LAST_SESSION_TOP_SET',
          basedOn: {
            sessionId: lastSessionWithExercise.id,
            performedAt: lastSessionWithExercise.startedAt.toISOString(),
            setId: topSet.id,
            weight: topSet.weight,
            reps: topSet.reps,
          },
        };
      }
    }

    // 2) BestRecentE1rm: last 8 sessions where exercise performed FOR THIS USER
    const windowSessions = await this.prisma.workoutSession.findMany({
      where: {
        userId,
        id: { not: sessionId },
        sets: { some: { dayExercise: { exerciseId } } },
      },
      orderBy: [{ startedAt: 'desc' }, { id: 'desc' }],
      take: 8,
      select: { id: true, startedAt: true },
    });

    let bestRecentE1rm: any = null;

    if (windowSessions.length > 0) {
      const sessionIds = windowSessions.map((s) => s.id);
      const startedAtBySessionId = new Map(windowSessions.map((s) => [s.id, s.startedAt] as const));

      const eligibleSets = await this.prisma.workoutSet.findMany({
        where: {
          sessionId: { in: sessionIds },
          dayExercise: { exerciseId },
          reps: { gte: 3, lte: 12 },
          weight: { gt: 0 },
        },
        select: {
          id: true,
          sessionId: true,
          reps: true,
          weight: true,
        },
      });

      const epley = (w: number, r: number) => w * (1 + r / 30);

      if (eligibleSets.length > 0) {
        let best = eligibleSets[0];
        let bestVal = epley(best.weight, best.reps);

        for (let i = 1; i < eligibleSets.length; i++) {
          const cur = eligibleSets[i];
          const curVal = epley(cur.weight, cur.reps);

          const bestAt = startedAtBySessionId.get(best.sessionId) ?? new Date(0);
          const curAt = startedAtBySessionId.get(cur.sessionId) ?? new Date(0);

          const isBetter =
            curVal > bestVal ||
            (curVal === bestVal && cur.weight > best.weight) ||
            (curVal === bestVal && cur.weight === best.weight && cur.reps > best.reps) ||
            (curVal === bestVal &&
              cur.weight === best.weight &&
              cur.reps === best.reps &&
              curAt > bestAt) ||
            (curVal === bestVal &&
              cur.weight === best.weight &&
              cur.reps === best.reps &&
              curAt.getTime() === bestAt.getTime() &&
              cur.id > best.id);

          if (isBetter) {
            best = cur;
            bestVal = curVal;
          }
        }

        const performedAt = startedAtBySessionId.get(best.sessionId) ?? new Date(0);

        bestRecentE1rm = {
          windowSessions: 8,
          formula: 'EPLEY',
          repsFilter: { min: 3, max: 12 },
          e1rm: Number(bestVal.toFixed(1)),
          set: {
            sessionId: best.sessionId,
            performedAt: performedAt.toISOString(),
            setId: best.id,
            weight: best.weight,
            reps: best.reps,
          },
        };
      }
    }

    return {
      sessionId,
      dayExerciseId,
      exerciseId,
      suggested,
      bestRecentE1rm,
    };
  }
}