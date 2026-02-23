import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import {
  GetProgressQueryDto,
  ProgressMetric,
} from './dto/get-progress.query.dto';

type ProgressPoint = {
  sessionId: number;
  date: string;
  value: number | null;
  emaValue: number | null;
};

@Injectable()
export class ProgressService {
  private static readonly EMA_ALPHA = 0.25;

  constructor(private readonly prisma: PrismaService) {}

  async getContext(userId: number) {
    const programs = await this.prisma.program.findMany({
      where: {
        userId,
        OR: [
          { isActive: true },
          { workoutSessions: { some: { endedAt: { not: null } } } },
        ],
      },
      orderBy: [{ isActive: 'desc' }, { createdAt: 'desc' }],
      select: {
        id: true,
        name: true,
        isActive: true,
        days: {
          orderBy: { order: 'asc' },
          select: { id: true, name: true, order: true },
        },
      },
    });

    const ranges = await this.prisma.workoutSession.groupBy({
      by: ['programId'],
      where: { userId, endedAt: { not: null } },
      _min: { startedAt: true },
      _max: { startedAt: true },
      _count: { _all: true },
    });

    const rangeByProgramId = new Map(
      ranges.map((row) => [
        row.programId,
        {
          firstSessionAt: row._min.startedAt?.toISOString() ?? null,
          lastSessionAt: row._max.startedAt?.toISOString() ?? null,
          completedSessionsCount: row._count._all,
        },
      ]),
    );

    return {
      programs: programs.map((program) => {
        const range = rangeByProgramId.get(program.id);
        return {
          id: program.id,
          name: program.name,
          isActive: program.isActive,
          days: program.days,
          firstSessionAt: range?.firstSessionAt ?? null,
          lastSessionAt: range?.lastSessionAt ?? null,
          completedSessionsCount: range?.completedSessionsCount ?? 0,
        };
      }),
    };
  }

  async getSeries(userId: number, query: GetProgressQueryDto) {
    await this.ensureOwnership(userId, query.programId, query.programDayId);

    const sessions = await this.prisma.workoutSession.findMany({
      where: {
        userId,
        programId: query.programId,
        programDayId: query.programDayId,
        endedAt: { not: null },
      },
      orderBy: [{ startedAt: 'asc' }, { id: 'asc' }],
      select: {
        id: true,
        startedAt: true,
        sets: {
          select: { reps: true, weight: true },
        },
      },
    });

    const points = this.buildPoints(sessions, query.metric);

    return {
      alpha: ProgressService.EMA_ALPHA,
      metric: query.metric,
      points,
    };
  }

  private async ensureOwnership(
    userId: number,
    programId: number,
    programDayId: number,
  ) {
    const day = await this.prisma.programDay.findFirst({
      where: {
        id: programDayId,
        programId,
        program: { userId },
      },
      select: { id: true },
    });

    if (!day) {
      throw new NotFoundException('Program day not found');
    }
  }

  private buildPoints(
    sessions: Array<{
      id: number;
      startedAt: Date;
      sets: Array<{ reps: number; weight: number }>;
    }>,
    metric: ProgressMetric,
  ): ProgressPoint[] {
    const points: ProgressPoint[] = [];
    let emaPrev: number | null = null;

    for (const session of sessions) {
      const value =
        metric === ProgressMetric.VOLUME
          ? this.computeVolume(session.sets)
          : this.computeBestE1rm(session.sets);

      let emaValue: number | null = null;
      if (value !== null) {
        emaPrev =
          emaPrev === null
            ? value
            : ProgressService.EMA_ALPHA * value +
              (1 - ProgressService.EMA_ALPHA) * emaPrev;
        emaValue = Number(emaPrev.toFixed(1));
      }

      points.push({
        sessionId: session.id,
        date: session.startedAt.toISOString(),
        value,
        emaValue,
      });
    }

    return points;
  }

  private computeVolume(sets: Array<{ reps: number; weight: number }>): number {
    const total = sets.reduce((sum, set) => sum + set.weight * set.reps, 0);
    return Number(total.toFixed(1));
  }

  private computeBestE1rm(
    sets: Array<{ reps: number; weight: number }>,
  ): number | null {
    let best: number | null = null;

    for (const set of sets) {
      if (!(set.weight > 0 && set.reps >= 3 && set.reps <= 12)) continue;
      const e1rm = set.weight * (1 + set.reps / 30);
      const rounded = Number(e1rm.toFixed(1));
      if (best === null || rounded > best) {
        best = rounded;
      }
    }

    return best;
  }
}
