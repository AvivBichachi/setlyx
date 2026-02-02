-- This is an empty migration.

CREATE UNIQUE INDEX "WorkoutSession_user_one_active"
ON "WorkoutSession" ("userId")
WHERE "endedAt" IS NULL;
