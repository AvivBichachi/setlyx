import { PrismaClient, ProgramType, MuscleGroup } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  // 1) Clean (optional but recommended for deterministic dev seed)
  // NOTE: order matters because of relations
  await prisma.workoutSet.deleteMany();
  await prisma.workoutSession.deleteMany();
  await prisma.dayExercise.deleteMany();
  await prisma.exercise.deleteMany();
  await prisma.programDay.deleteMany();
  await prisma.program.deleteMany();
  await prisma.user.deleteMany();

  // 2) Users
  const user1 = await prisma.user.create({ data: {} });
  const user2 = await prisma.user.create({ data: {} });

  // 3) Program for user1
  const program = await prisma.program.create({
    data: {
      name: 'Beginner Glutes (Seed)',
      type: ProgramType.PPL,
      isActive: true,
      userId: user1.id,
    },
  });

  // 4) Days
  const day1 = await prisma.programDay.create({
    data: { name: 'Day 1 - Lower', order: 1, programId: program.id },
  });

  const day2 = await prisma.programDay.create({
    data: { name: 'Day 2 - Upper', order: 2, programId: program.id },
  });

  const day3 = await prisma.programDay.create({
    data: { name: 'Day 3 - Lower', order: 3, programId: program.id },
  });

  // 5) Exercises
  const exSeed = [
    { name: 'Hip Thrust', primaryMuscle: MuscleGroup.GLUTES },
    { name: 'Romanian Deadlift', primaryMuscle: MuscleGroup.HAMSTRINGS },
    { name: 'Bulgarian Split Squat', primaryMuscle: MuscleGroup.QUADS },
    { name: 'Lat Pulldown', primaryMuscle: MuscleGroup.BACK },
    { name: 'Dumbbell Row', primaryMuscle: MuscleGroup.BACK },
    { name: 'Shoulder Press', primaryMuscle: MuscleGroup.SHOULDERS },
  ] as const;

  const exercises = await Promise.all(
    exSeed.map((ex) =>
      prisma.exercise.create({
        data: { name: ex.name, primaryMuscle: ex.primaryMuscle },
      }),
    ),
  );


  const byName = new Map(exercises.map((e) => [e.name, e.id] as const));

  // 6) DayExercise per day (orders must be unique per day)
  // Day 1 - Lower
  await prisma.dayExercise.createMany({
    data: [
      {
        programDayId: day1.id,
        exerciseId: byName.get('Hip Thrust')!,
        order: 1,
        targetSets: 4,
        minReps: 6,
        maxReps: 10,
      },
      {
        programDayId: day1.id,
        exerciseId: byName.get('Romanian Deadlift')!,
        order: 2,
        targetSets: 3,
        minReps: 6,
        maxReps: 10,
      },
      {
        programDayId: day1.id,
        exerciseId: byName.get('Bulgarian Split Squat')!,
        order: 3,
        targetSets: 3,
        minReps: 8,
        maxReps: 12,
      },
    ],
  });

  // Day 2 - Upper
  await prisma.dayExercise.createMany({
    data: [
      {
        programDayId: day2.id,
        exerciseId: byName.get('Lat Pulldown')!,
        order: 1,
        targetSets: 3,
        minReps: 8,
        maxReps: 12,
      },
      {
        programDayId: day2.id,
        exerciseId: byName.get('Dumbbell Row')!,
        order: 2,
        targetSets: 3,
        minReps: 8,
        maxReps: 12,
      },
      {
        programDayId: day2.id,
        exerciseId: byName.get('Shoulder Press')!,
        order: 3,
        targetSets: 3,
        minReps: 6,
        maxReps: 10,
      },
    ],
  });

  // Day 3 - Lower (variation)
  await prisma.dayExercise.createMany({
    data: [
      {
        programDayId: day3.id,
        exerciseId: byName.get('Hip Thrust')!,
        order: 1,
        targetSets: 3,
        minReps: 8,
        maxReps: 12,
      },
      {
        programDayId: day3.id,
        exerciseId: byName.get('Romanian Deadlift')!,
        order: 2,
        targetSets: 3,
        minReps: 8,
        maxReps: 12,
      },
    ],
  });

  // 7) Optional: create an ACTIVE session for user1 (to test Resume)
  // Comment out if you want "no active session" by default.
  await prisma.workoutSession.create({
    data: {
      userId: user1.id,
      programId: program.id,
      programDayId: day1.id,
      endedAt: null,
    },
  });

  console.log('✅ Seed done');
  console.log('User1:', user1.id, 'User2:', user2.id);
  console.log('Program:', program.id, 'Day1:', day1.id);
}

main()
  .catch((e) => {
    console.error('❌ Seed failed', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
