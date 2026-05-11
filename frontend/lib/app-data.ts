import { prisma } from "@/lib/prisma";

export async function getAppData<T>(key: string, fallback: T): Promise<T> {
  const records = await prisma.$queryRaw<Array<{ value: unknown }>>`
    SELECT value
    FROM "AppData"
    WHERE key = ${key}
    LIMIT 1
  `;

  const record = records[0];

  if (!record) {
    return fallback;
  }

  return record.value as T;
}

export async function setAppData<T>(key: string, value: T): Promise<T> {
  const serializedValue = JSON.stringify(value);

  await prisma.$executeRaw`
    INSERT INTO "AppData" (key, value, "updatedAt")
    VALUES (${key}, ${serializedValue}::jsonb, NOW())
    ON CONFLICT (key)
    DO UPDATE SET value = EXCLUDED.value, "updatedAt" = NOW()
  `;

  return value;
}
