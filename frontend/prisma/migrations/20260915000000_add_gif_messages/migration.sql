-- CreateEnum
CREATE TYPE "MessageType" AS ENUM ('TEXT', 'GIF');

-- AlterTable
ALTER TABLE "Message"
ADD COLUMN "type" "MessageType" NOT NULL DEFAULT 'TEXT',
ADD COLUMN "gifId" TEXT,
ADD COLUMN "gifUrl" TEXT,
ADD COLUMN "gifPreviewUrl" TEXT,
ADD COLUMN "gifTitle" TEXT,
ADD COLUMN "gifWidth" INTEGER,
ADD COLUMN "gifHeight" INTEGER;