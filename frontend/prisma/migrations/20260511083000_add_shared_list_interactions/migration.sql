-- CreateTable
CREATE TABLE "SharedListLike" (
    "id" TEXT NOT NULL,
    "sharedListId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SharedListLike_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SharedListComment" (
    "id" TEXT NOT NULL,
    "sharedListId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "parentId" TEXT,
    "body" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SharedListComment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "SharedListLike_sharedListId_idx" ON "SharedListLike"("sharedListId");

-- CreateIndex
CREATE INDEX "SharedListLike_userId_idx" ON "SharedListLike"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "SharedListLike_sharedListId_userId_key" ON "SharedListLike"("sharedListId", "userId");

-- CreateIndex
CREATE INDEX "SharedListComment_sharedListId_idx" ON "SharedListComment"("sharedListId");

-- CreateIndex
CREATE INDEX "SharedListComment_userId_idx" ON "SharedListComment"("userId");

-- CreateIndex
CREATE INDEX "SharedListComment_parentId_idx" ON "SharedListComment"("parentId");

-- AddForeignKey
ALTER TABLE "SharedListLike" ADD CONSTRAINT "SharedListLike_sharedListId_fkey" FOREIGN KEY ("sharedListId") REFERENCES "SharedList"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SharedListLike" ADD CONSTRAINT "SharedListLike_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SharedListComment" ADD CONSTRAINT "SharedListComment_sharedListId_fkey" FOREIGN KEY ("sharedListId") REFERENCES "SharedList"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SharedListComment" ADD CONSTRAINT "SharedListComment_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SharedListComment" ADD CONSTRAINT "SharedListComment_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "SharedListComment"("id") ON DELETE CASCADE ON UPDATE CASCADE;