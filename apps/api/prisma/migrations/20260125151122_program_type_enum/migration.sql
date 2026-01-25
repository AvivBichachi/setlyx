/*
  Warnings:

  - Changed the type of `type` on the `Program` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.

*/
-- AlterTable
ALTER TABLE "Program" DROP COLUMN "type",
ADD COLUMN     "type" "ProgramType" NOT NULL;
