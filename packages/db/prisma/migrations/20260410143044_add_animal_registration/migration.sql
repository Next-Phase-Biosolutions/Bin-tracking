-- CreateTable
CREATE TABLE "animal_registrations" (
    "id" TEXT NOT NULL,
    "animalType" TEXT NOT NULL,
    "breed" TEXT,
    "age" TEXT,
    "weight" TEXT,
    "ownerName" TEXT NOT NULL,
    "healthCondition" TEXT,
    "rawTranscript" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "animal_registrations_pkey" PRIMARY KEY ("id")
);
