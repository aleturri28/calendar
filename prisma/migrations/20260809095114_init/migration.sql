-- CreateTable
CREATE TABLE "User" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "name" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL
);

-- CreateTable
CREATE TABLE "DayEntry" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "date" TEXT NOT NULL,
    "userId" INTEGER NOT NULL,
    "minDuration" INTEGER NOT NULL DEFAULT 30,
    "photoUrl" TEXT,
    "photoPublicId" TEXT,
    "photoUploadedAt" DATETIME,
    "videoUrl" TEXT,
    "videoPublicId" TEXT,
    "videoDuration" REAL,
    "videoUploadedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "DayEntry_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Event" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "title" TEXT NOT NULL,
    "emoji" TEXT,
    "startDate" TEXT NOT NULL,
    "endDate" TEXT NOT NULL,
    "isMeetup" BOOLEAN NOT NULL DEFAULT false,
    "createdById" INTEGER NOT NULL
);

-- CreateIndex
CREATE UNIQUE INDEX "User_name_key" ON "User"("name");

-- CreateIndex
CREATE INDEX "DayEntry_date_idx" ON "DayEntry"("date");

-- CreateIndex
CREATE UNIQUE INDEX "DayEntry_date_userId_key" ON "DayEntry"("date", "userId");

-- CreateIndex
CREATE INDEX "Event_startDate_idx" ON "Event"("startDate");
