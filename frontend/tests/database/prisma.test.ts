import { randomUUID } from "node:crypto";
import { afterAll, describe, expect, it } from "vitest";

import { prisma } from "../../lib/prisma";

describe("Prisma database", () => {
  it("can query the migrated User table", async () => {
    await expect(prisma.user.count()).resolves.toBeGreaterThanOrEqual(0);
  });

  it("enforces unique user email and username constraints", async () => {
    const token = randomUUID();
    const email = `prisma-test-${token}@example.invalid`;
    const username = `prisma_test_${token.replaceAll("-", "").slice(0, 20)}`;
    let userId: string | undefined;

    try {
      const user = await prisma.user.create({
        data: { email, username },
      });
      userId = user.id;

      await expect(
        prisma.user.create({ data: { email } }),
      ).rejects.toMatchObject({ code: "P2002" });
      await expect(
        prisma.user.create({ data: { username } }),
      ).rejects.toMatchObject({ code: "P2002" });
    } finally {
      if (userId) {
        await prisma.user.delete({ where: { id: userId } });
      }
    }
  });

  it("enforces compound relation keys and cascades group dependents", async () => {
    const token = randomUUID();
    let ownerId: string | undefined;
    let memberId: string | undefined;
    let groupId: string | undefined;

    try {
      const owner = await prisma.user.create({
        data: { email: `prisma-owner-${token}@example.invalid` },
      });
      ownerId = owner.id;

      const member = await prisma.user.create({
        data: { email: `prisma-member-${token}@example.invalid` },
      });
      memberId = member.id;

      const group = await prisma.group.create({
        data: {
          creatorId: owner.id,
          name: `Prisma integration ${token}`,
          description: "Created by an isolated database test",
        },
      });
      groupId = group.id;

      await prisma.groupMember.create({
        data: { groupId: group.id, userId: member.id },
      });
      await expect(
        prisma.groupMember.create({
          data: { groupId: group.id, userId: member.id },
        }),
      ).rejects.toMatchObject({ code: "P2002" });

      await prisma.groupMovie.create({
        data: { groupId: group.id, tmdbId: `prisma-test-${token}` },
      });

      await prisma.group.delete({ where: { id: group.id } });

      await expect(
        prisma.groupMember.count({ where: { groupId: group.id } }),
      ).resolves.toBe(0);
      await expect(
        prisma.groupMovie.count({ where: { groupId: group.id } }),
      ).resolves.toBe(0);
    } finally {
      if (groupId) {
        await prisma.group.deleteMany({ where: { id: groupId } });
      }
      if (ownerId) {
        await prisma.user.deleteMany({ where: { id: ownerId } });
      }
      if (memberId) {
        await prisma.user.deleteMany({ where: { id: memberId } });
      }
    }
  });
});

afterAll(async () => {
  await prisma.$disconnect();
});