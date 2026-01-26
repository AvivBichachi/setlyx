/*
  Warnings:

  - A unique constraint covering the columns `[programDayId,order]` on the table `DayExercise` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateIndex
CREATE UNIQUE INDEX "DayExercise_programDayId_order_key" ON "DayExercise"("programDayId", "order");
