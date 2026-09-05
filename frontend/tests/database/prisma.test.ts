import { afterAll, describe, expect, it } from "vitest";

import { prisma } from "../../lib/prisma";

describe("Prisma database", () => {
  it("can query the migrated User table", async () => {
    await expect(prisma.user.count()).resolves.toBeGreaterThanOrEqual(0);
  });
});

afterAll(async () => {
  await prisma.$disconnect();
});