/*
  Warnings:

  - Added the required column `primaryMuscle` to the `Exercise` table without a default value. This is not possible if the table is not empty.

*/
-- CreateEnum
CREATE TYPE "MuscleGroup" AS ENUM ('CHEST', 'BACK', 'SHOULDERS', 'BICEPS', 'TRICEPS', 'QUADS', 'HAMSTRINGS', 'GLUTES', 'CALVES', 'ABS');

-- AlterTable
ALTER TABLE "Exercise" ADD COLUMN     "primaryMuscle" "MuscleGroup" NOT NULL;
