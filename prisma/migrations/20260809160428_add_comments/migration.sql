-- CreateTable
CREATE TABLE "Comment" (
    "id" SERIAL NOT NULL,
    "dayEntryId" INTEGER NOT NULL,
    "target" TEXT NOT NULL,
    "userId" INTEGER NOT NULL,
    "text" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Comment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Comment_dayEntryId_idx" ON "Comment"("dayEntryId");

-- AddForeignKey
ALTER TABLE "Comment" ADD CONSTRAINT "Comment_dayEntryId_fkey" FOREIGN KEY ("dayEntryId") REFERENCES "DayEntry"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Comment" ADD CONSTRAINT "Comment_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
