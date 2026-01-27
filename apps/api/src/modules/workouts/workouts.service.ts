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
  constructor(private readonly prisma: PrismaService) { }

  private async ensureProgramDayOwnership(programId: number, programDayId: number) {
    const day = await this.prisma.programDay.findFirst({
      where: { id: programDayId, programId },
      select: { id: true },
    });
    if (!day) throw new NotFoundException('Program day not found under program');
  }

  private async getSessionOr404(sessionId: number) {
    const session = await this.prisma.workoutSession.findUnique({
      where: { id: sessionId },
      select: { id: true, programId: true, programDayId: true, endedAt: true },
    });
    if (!session) throw new NotFoundException('Workout session not found');
    return session;
  }

  async start(dto: StartWorkoutSessionDto) {
    await this.ensureProgramDayOwnership(dto.programId, dto.programDayId);

    return this.prisma.workoutSession.create({
      data: {
        programId: dto.programId,
        programDayId: dto.programDayId,
      },
    });
  }

  async getSession(sessionId: number) {
    await this.getSessionOr404(sessionId);

    return this.prisma.workoutSession.findUnique({
      where: { id: sessionId },
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

  async addSet(sessionId: number, dto: CreateWorkoutSetDto): Promise<WorkoutSet> {
    const session = await this.getSessionOr404(sessionId);
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

  async finish(sessionId: number) {
    await this.getSessionOr404(sessionId);

    return this.prisma.workoutSession.update({
      where: { id: sessionId },
      data: { endedAt: new Date() },
    });
  }

  async findAll() {
    return this.prisma.workoutSession.findMany({
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

  async findOneDetailed(sessionId: number) {
    const session = await this.prisma.workoutSession.findUnique({
      where: { id: sessionId },
      include: {
        program: { select: { id: true, name: true, type: true } },
        programDay: { select: { id: true, name: true, order: true } },
      },
    });


    if (!session) {
      throw new NotFoundException('Workout session not found');
    }

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
}