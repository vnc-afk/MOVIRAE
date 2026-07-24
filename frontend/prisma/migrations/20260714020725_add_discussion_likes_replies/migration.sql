/*
  Warnings:

  - You are about to drop the column `likedBy` on the `GroupDiscussion` table. All the data in the column will be lost.
  - You are about to drop the column `replyItems` on the `GroupDiscussion` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "GroupDiscussion" DROP COLUMN "likedBy",
DROP COLUMN "replyItems";

-- CreateTable
CREATE TABLE "GroupDiscussionLike" (
    "id" TEXT NOT NULL,
    "discussionId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GroupDiscussionLike_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GroupDiscussionReply" (
    "id" TEXT NOT NULL,
    "discussionId" TEXT NOT NULL,
    "authorId" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GroupDiscussionReply_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "GroupDiscussionLike_discussionId_idx" ON "GroupDiscussionLike"("discussionId");

-- CreateIndex
CREATE INDEX "GroupDiscussionLike_userId_idx" ON "GroupDiscussionLike"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "GroupDiscussionLike_discussionId_userId_key" ON "GroupDiscussionLike"("discussionId", "userId");

-- CreateIndex
CREATE INDEX "GroupDiscussionReply_discussionId_idx" ON "GroupDiscussionReply"("discussionId");

-- CreateIndex
CREATE INDEX "GroupDiscussionReply_authorId_idx" ON "GroupDiscussionReply"("authorId");

-- AddForeignKey
ALTER TABLE "GroupDiscussionLike" ADD CONSTRAINT "GroupDiscussionLike_discussionId_fkey" FOREIGN KEY ("discussionId") REFERENCES "GroupDiscussion"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GroupDiscussionLike" ADD CONSTRAINT "GroupDiscussionLike_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GroupDiscussionReply" ADD CONSTRAINT "GroupDiscussionReply_discussionId_fkey" FOREIGN KEY ("discussionId") REFERENCES "GroupDiscussion"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GroupDiscussionReply" ADD CONSTRAINT "GroupDiscussionReply_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
