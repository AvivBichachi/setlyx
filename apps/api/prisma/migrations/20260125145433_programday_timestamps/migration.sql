/*
  Warnings:

  - A unique constraint covering the columns `[programId,order]` on the table `ProgramDay` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `updatedAt` to the `Program` table without a default value. This is not possible if the table is not empty.
  - Added the required column `updatedAt` to the `ProgramDay` table without a default value. This is not possible if the table is not empty.

*/
-- CreateEnum
CREATE TYPE "ProgramType" AS ENUM ('AB', 'PPL', 'FULL_BODY', 'CUSTOM');

-- AlterTable
ALTER TABLE "Program" ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL;

-- AlterTable
ALTER TABLE "ProgramDay" ADD COLUMN     "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "ProgramDay_programId_order_key" ON "ProgramDay"("programId", "order");
