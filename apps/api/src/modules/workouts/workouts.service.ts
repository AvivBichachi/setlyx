import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { MuscleGroup, Prisma, WorkoutSet } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { StartWorkoutSessionDto } from './dto/start-workout-session.dto';
import { CreateWorkoutSetDto } from './dto/create-workout-set.dto';

@Injectable()
export class WorkoutsService {
  constructor(private readonly prisma: PrismaService) { }

  private async ensureProgramDayOwnership(userId: number, programDayId: number): Promise<{ id: number; programId: number }> {
    const day = await this.prisma.programDay.findFirst({
      where: { id: programDayId, program: { userId } },
      select: { id: true, programId: true },
    });

    if (!day) throw new NotFoundException('Program day not found');
    return day;
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
    const active = await this.prisma.workoutSession.findFirst({
      where: { userId, endedAt: null },
      select: { id: true },
    });

    if (active) {
      throw new ConflictException('Active workout session already exists');
    }

    const day = await this.ensureProgramDayOwnership(userId, dto.programDayId);

    try {
      return await this.prisma.workoutSession.create({
        data: {
          userId,
          programId: day.programId,
          programDayId: day.id,
        },
        select: {
          id: true,
          startedAt: true,
          endedAt: true,
          programId: true,
          programDayId: true,
        },
      });
    } catch (e) {
      if (
        e instanceof Prisma.PrismaClientKnownRequestError &&
        e.code === 'P2002'
      ) {
        throw new ConflictException('Active workout session already exists');
      }
      throw e;
    }
  }


  async getSession(userId: number, sessionId: number) {
    await this.getSessionOr404(userId, sessionId);

    return this.prisma.workoutSession.findFirst({
      where: { id: sessionId, userId },
      include: {
        sets: {
          orderBy: [{ dayExerciseId: 'asc' }, { setNumber: 'asc' }],
          include: {
            dayExercise: {
              include: {
                exercise: { select: { id: true, name: true, primaryMuscle: true } },
              },
            },
          },
        },
      },
    });
  }

  async getActiveSession(userId: number) {
    const session = await this.prisma.workoutSession.findFirst({
      where: { userId, endedAt: null },
      orderBy: [{ startedAt: 'desc' }, { id: 'desc' }],
      select: {
        id: true,
        startedAt: true,
        endedAt: true,
        programId: true,
        programDayId: true,
      },
    });

    return session ?? null;
  }


  async getLastCompletedSession(userId: number) {
    const session = await this.prisma.workoutSession.findFirst({
      where: { userId, endedAt: { not: null } },
      orderBy: [{ endedAt: 'desc' }, { id: 'desc' }],
      select: {
        id: true,
        startedAt: true,
        endedAt: true,
        program: { select: { id: true, name: true, type: true } },
        programDay: { select: { id: true, name: true, order: true } },
      },
    });

    return session ?? null;
  }




  async addSet(
    userId: number,
    sessionId: number,
    dto: CreateWorkoutSetDto,
  ): Promise<WorkoutSet> {
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
          sessionId: session.id,
          dayExerciseId: dto.dayExerciseId,
          setNumber: dto.setNumber,
          reps: dto.reps,
          weight: dto.weight,
        },
      });
    } catch (e) {
      if (
        e instanceof Prisma.PrismaClientKnownRequestError &&
        e.code === 'P2002'
      ) {
        throw new ConflictException(
          'Set number already exists for this exercise in this session',
        );
      }
      throw e;
    }
  }

  async finish(userId: number, sessionId: number) {
    // 1) Find session ONLY if owned by this user (prevents info leak)
    const session = await this.prisma.workoutSession.findFirst({
      where: { id: sessionId, userId },
      select: {
        id: true,
        endedAt: true,
        startedAt: true,
        programId: true,
        programDayId: true,
      },
    });

    // Not found OR not yours -> same response (no enumeration)
    if (!session) {
      throw new NotFoundException('Workout session not found');
    }

    // 2) Owned by user: now it’s safe to be explicit
    if (session.endedAt) {
      // choose one:
      // A) 409 conflict (explicit)
      throw new ConflictException('Workout session already finished');

      // or B) idempotent finish: return the session as-is (often nicer UX)
      // return session;
    }

    // 3) Close it
    return this.prisma.workoutSession.update({
      where: { id: sessionId },
      data: { endedAt: new Date() },
      select: {
        id: true,
        startedAt: true,
        endedAt: true,
        programId: true,
        programDayId: true,
      },
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
      include: { exercise: { select: { id: true, name: true, primaryMuscle: true } } },
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
    await this.getSessionOr404(userId, sessionId);

    const session = await this.prisma.workoutSession.findFirst({
      where: { id: sessionId, userId },
      select: { id: true, startedAt: true, endedAt: true, programDayId: true },
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
            exercise: { select: { id: true, name: true, primaryMuscle: true } },
          },
        },
      },
    });

    const durationSeconds = session.endedAt
      ? Math.floor((session.endedAt.getTime() - session.startedAt.getTime()) / 1000)
      : null;

    let totalSets = 0;
    let totalReps = 0;
    let totalVolume = 0;

    // ---- Strength signal config ----
    const STRENGTH_REPS_MIN = 3;
    const STRENGTH_REPS_MAX = 12;
    const EPS = 0.1; // float tolerance for e1RM comparisons

    // ---- Hypertrophy/workload signal config ----
    // For volume: treat tiny swings as SAME, so UI doesn't flicker.
    const VOLUME_SAME_PCT = 0.02; // ±2% => SAME

    const epleyE1rm = (w: number, r: number) => w * (1 + r / 30);
    const isStrengthEligible = (w: number, r: number) =>
      w > 0 && r >= STRENGTH_REPS_MIN && r <= STRENGTH_REPS_MAX;

    type ProgressState = 'IMPROVED' | 'REGRESSED' | 'SAME' | 'NO_BASELINE';

    type BestE1rmSet = {
      setId: number;
      weight: number;
      reps: number;
      e1rm: number;
    };

    type ExerciseAgg = {
      exerciseId: number;
      name: string;
      primaryMuscle: MuscleGroup;
      sets: number;
      repsTotal: number;
      volume: number;

      // strength
      bestE1rmSet: BestE1rmSet | null;
    };

    type MuscleAgg = {
      muscle: MuscleGroup;
      totalSets: number;
      totalReps: number;
      totalVolume: number;
    };

    const byExercise = new Map<number, ExerciseAgg>();
    const byMuscle = new Map<MuscleGroup, MuscleAgg>();

    // Comparator: pick "best" strength set
    const isBetterStrength = (a: BestE1rmSet, b: BestE1rmSet) =>
      a.e1rm > b.e1rm + EPS ||
      (Math.abs(a.e1rm - b.e1rm) <= EPS && a.weight > b.weight) ||
      (Math.abs(a.e1rm - b.e1rm) <= EPS && a.weight === b.weight && a.reps > b.reps) ||
      (Math.abs(a.e1rm - b.e1rm) <= EPS &&
        a.weight === b.weight &&
        a.reps === b.reps &&
        a.setId > b.setId);

    // ----- CURRENT session aggregation -----
    for (const s of sets) {
      const ex = s.dayExercise.exercise;
      const muscle = ex.primaryMuscle;
      const volume = s.reps * s.weight;

      // muscle totals (hypertrophy/workload signal)
      const m = byMuscle.get(muscle) ?? {
        muscle,
        totalSets: 0,
        totalReps: 0,
        totalVolume: 0,
      };

      m.totalSets += 1;
      m.totalReps += s.reps;
      m.totalVolume += volume;
      byMuscle.set(muscle, m);

      // session totals
      totalSets += 1;
      totalReps += s.reps;
      totalVolume += volume;

      // per-exercise aggregation
      const curr = byExercise.get(ex.id) ?? {
        exerciseId: ex.id,
        name: ex.name,
        primaryMuscle: ex.primaryMuscle,
        sets: 0,
        repsTotal: 0,
        volume: 0,
        bestE1rmSet: null,
      };

      curr.sets += 1;
      curr.repsTotal += s.reps;
      curr.volume += volume;

      // strength: best e1RM set in range
      if (isStrengthEligible(s.weight, s.reps)) {
        const cand: BestE1rmSet = {
          setId: s.id,
          weight: s.weight,
          reps: s.reps,
          e1rm: Number(epleyE1rm(s.weight, s.reps).toFixed(1)),
        };

        if (curr.bestE1rmSet === null || isBetterStrength(cand, curr.bestE1rmSet)) {
          curr.bestE1rmSet = cand;
        }
      }

      byExercise.set(ex.id, curr);
    }

    // ----- PREVIOUS session lookup (same ProgramDay) -----
    const previousSession = await this.prisma.workoutSession.findFirst({
      where: {
        userId,
        programDayId: session.programDayId,
        startedAt: { lt: session.startedAt },
      },
      orderBy: { startedAt: 'desc' },
      select: { id: true },
    });

    const exerciseIds = Array.from(byExercise.keys());

    // Strength baseline
    const prevBestByExerciseId = new Map<number, BestE1rmSet>();

    // Hypertrophy/workload baselines (volume totals)
    const prevVolumeByExerciseId = new Map<number, number>();
    const prevMuscleTotals = new Map<MuscleGroup, MuscleAgg>();

    if (previousSession && exerciseIds.length > 0) {
      // Pull ALL sets for those exercises in previous session (for volume + muscle totals)
      const prevAllSets = await this.prisma.workoutSet.findMany({
        where: {
          sessionId: previousSession.id,
          dayExercise: { exerciseId: { in: exerciseIds } },
          weight: { gt: 0 },
          reps: { gt: 0 },
        },
        select: {
          id: true,
          weight: true,
          reps: true,
          dayExercise: {
            select: {
              exerciseId: true,
              exercise: { select: { primaryMuscle: true } },
            },
          },
        },
      });

      // Pull eligible sets for strength (could also filter from prevAllSets, but this keeps intent clear)
      const prevStrengthSets = prevAllSets.filter((ps) =>
        isStrengthEligible(ps.weight, ps.reps),
      );

      // 1) Strength baseline: best e1RM per exercise
      for (const ps of prevStrengthSets) {
        const exId = ps.dayExercise.exerciseId;
        const cand: BestE1rmSet = {
          setId: ps.id,
          weight: ps.weight,
          reps: ps.reps,
          e1rm: Number(epleyE1rm(ps.weight, ps.reps).toFixed(1)),
        };

        const existing = prevBestByExerciseId.get(exId);
        if (!existing || isBetterStrength(cand, existing)) {
          prevBestByExerciseId.set(exId, cand);
        }
      }

      // 2) Hypertrophy baseline: total volume per exercise + per muscle
      for (const ps of prevAllSets) {
        const exId = ps.dayExercise.exerciseId;
        const muscle = ps.dayExercise.exercise.primaryMuscle;
        const vol = ps.weight * ps.reps;

        prevVolumeByExerciseId.set(exId, (prevVolumeByExerciseId.get(exId) ?? 0) + vol);

        const m = prevMuscleTotals.get(muscle) ?? {
          muscle,
          totalSets: 0,
          totalReps: 0,
          totalVolume: 0,
        };

        m.totalSets += 1;
        m.totalReps += ps.reps;
        m.totalVolume += vol;
        prevMuscleTotals.set(muscle, m);
      }
    }

    const classifyByPct = (current: number, previous: number): ProgressState => {
      if (previous <= 0) return 'NO_BASELINE';
      const pct = (current - previous) / previous;
      if (pct > VOLUME_SAME_PCT) return 'IMPROVED';
      if (pct < -VOLUME_SAME_PCT) return 'REGRESSED';
      return 'SAME';
    };

    type ExerciseSummary = {
      exerciseId: number;
      name: string;
      primaryMuscle: MuscleGroup;
      sets: number;
      repsTotal: number;

      // hypertrophy/workload signal (exercise-level)
      currentVolume: number;
      previousVolume: number | null;
      volumeDelta: number | null;
      volumeDeltaPct: number | null;
      hypertrophyProgress: ProgressState;

      // strength signal (exercise-level)
      currentBestE1rmSet: BestE1rmSet | null;
      previousBestE1rmSet: BestE1rmSet | null;
      strengthProgress: ProgressState;
    };

    const exercises: ExerciseSummary[] = [];

    for (const curr of byExercise.values()) {
      // ---- Strength progress ----
      const prevStrength = prevBestByExerciseId.get(curr.exerciseId) ?? null;

      let strengthProgress: ProgressState = 'NO_BASELINE';
      if (curr.bestE1rmSet && prevStrength) {
        const diff = curr.bestE1rmSet.e1rm - prevStrength.e1rm;
        if (diff > EPS) strengthProgress = 'IMPROVED';
        else if (diff < -EPS) strengthProgress = 'REGRESSED';
        else strengthProgress = 'SAME';
      }

      // ---- Hypertrophy/workload progress ----
      const prevVol = prevVolumeByExerciseId.get(curr.exerciseId);
      const previousVolume = prevVol !== undefined ? Number(prevVol.toFixed(1)) : null;

      let hypertrophyProgress: ProgressState = 'NO_BASELINE';
      let volumeDelta: number | null = null;
      let volumeDeltaPct: number | null = null;

      if (previousVolume !== null && previousVolume > 0) {
        volumeDelta = Number((curr.volume - previousVolume).toFixed(1));
        volumeDeltaPct = Number((((curr.volume - previousVolume) / previousVolume) * 100).toFixed(1));
        hypertrophyProgress = classifyByPct(curr.volume, previousVolume);
      }

      exercises.push({
        exerciseId: curr.exerciseId,
        name: curr.name,
        primaryMuscle: curr.primaryMuscle,
        sets: curr.sets,
        repsTotal: curr.repsTotal,

        currentVolume: Number(curr.volume.toFixed(1)),
        previousVolume,
        volumeDelta,
        volumeDeltaPct,
        hypertrophyProgress,

        currentBestE1rmSet: curr.bestE1rmSet,
        previousBestE1rmSet: prevStrength,
        strengthProgress,
      });
    }

    exercises.sort((a, b) => a.exerciseId - b.exerciseId);

    type MuscleSummary = {
      muscle: MuscleGroup;

      currentTotalSets: number;
      currentTotalReps: number;
      currentTotalVolume: number;

      previousTotalSets: number | null;
      previousTotalReps: number | null;
      previousTotalVolume: number | null;

      volumeDelta: number | null;
      volumeDeltaPct: number | null;
      hypertrophyProgress: ProgressState;
    };

    const muscleTotals: MuscleSummary[] = Array.from(byMuscle.values())
      .map((m) => {
        const prev = prevMuscleTotals.get(m.muscle);

        const previousTotalSets = prev ? prev.totalSets : null;
        const previousTotalReps = prev ? prev.totalReps : null;
        const previousTotalVolume = prev ? Number(prev.totalVolume.toFixed(1)) : null;

        let hypertrophyProgress: ProgressState = 'NO_BASELINE';
        let volumeDelta: number | null = null;
        let volumeDeltaPct: number | null = null;

        if (previousTotalVolume !== null && previousTotalVolume > 0) {
          volumeDelta = Number((m.totalVolume - previousTotalVolume).toFixed(1));
          volumeDeltaPct = Number((((m.totalVolume - previousTotalVolume) / previousTotalVolume) * 100).toFixed(1));
          hypertrophyProgress = classifyByPct(m.totalVolume, previousTotalVolume);
        }

        return {
          muscle: m.muscle,

          currentTotalSets: m.totalSets,
          currentTotalReps: m.totalReps,
          currentTotalVolume: Number(m.totalVolume.toFixed(1)),

          previousTotalSets,
          previousTotalReps,
          previousTotalVolume,

          volumeDelta,
          volumeDeltaPct,
          hypertrophyProgress,
        };
      })
      .sort((a, b) => a.muscle.localeCompare(b.muscle));

    return {
      sessionId: session.id,
      startedAt: session.startedAt,
      endedAt: session.endedAt,
      durationSeconds,
      totals: {
        totalSets,
        totalReps,
        totalVolume: Number(totalVolume.toFixed(1)),
      },

      // hypertrophy/workload signal (muscle-level + deltas)
      muscleTotals,

      // both signals (exercise-level)
      exercises,
    };
  }




  async getSetDefaults(userId: number, sessionId: number, dayExerciseId: number) {
    const session = await this.getSessionOr404(userId, sessionId);

    const de = await this.prisma.dayExercise.findFirst({
      where: { id: dayExerciseId, programDayId: session.programDayId },
      select: { id: true, exerciseId: true },
    });

    if (!de) throw new NotFoundException('Day exercise not found under session day');

    const exerciseId = de.exerciseId;

    const lastSessionWithExercise = await this.prisma.workoutSession.findFirst({
      where: {
        userId,
        id: { not: sessionId },
        sets: { some: { dayExercise: { exerciseId } } },
      },
      orderBy: [{ startedAt: 'desc' }, { id: 'desc' }],
      select: { id: true, startedAt: true },
    });

    let suggested: any = null;

    if (lastSessionWithExercise) {
      const topSet = await this.prisma.workoutSet.findFirst({
        where: { sessionId: lastSessionWithExercise.id, dayExercise: { exerciseId } },
        orderBy: [{ weight: 'desc' }, { reps: 'desc' }, { setNumber: 'desc' }, { id: 'desc' }],
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

    // window sessions
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
        select: { id: true, sessionId: true, reps: true, weight: true },
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