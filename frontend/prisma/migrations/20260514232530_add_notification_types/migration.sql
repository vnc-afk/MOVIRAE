/*
  Warnings:

  - The values [like,reply] on the enum `NotificationType` will be removed. If these variants are still used in the database, this will fail.

*/
-- AlterEnum
BEGIN;
CREATE TYPE "NotificationType_new" AS ENUM ('follow', 'review_like', 'review_reply', 'discussion_created', 'discussion_like', 'discussion_reply', 'event_created', 'shared_list_like', 'shared_list_comment', 'group_invite', 'recommendation');
ALTER TABLE "Notification" ALTER COLUMN "type" TYPE "NotificationType_new" USING ("type"::text::"NotificationType_new");
ALTER TYPE "NotificationType" RENAME TO "NotificationType_old";
ALTER TYPE "NotificationType_new" RENAME TO "NotificationType";
DROP TYPE "NotificationType_old";
COMMIT;
