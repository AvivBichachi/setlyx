import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const exercises = [
  'Bench Press',
  'Squat',
  'Deadlift',
  'Overhead Press',
  'Pull Up',
  'Lat Pulldown',
  'Barbell Row',
  'Dumbbell Curl',
  'Triceps Pushdown',
  'Leg Press',
];

async function main() {
  for (const name of exercises) {
    await prisma.exercise.upsert({
      where: { name },
      update: {},
      create: { name },
    });
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());