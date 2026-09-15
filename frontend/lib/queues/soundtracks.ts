import { Job, Queue } from "bullmq";

import { createBullMqConnection } from "@/lib/queues/redis";

export const SOUNDTRACK_QUEUE_NAME = "soundtracks";
export const BULLMQ_PREFIX = "movirae:bullmq";

export type SoundtrackRefreshJob = {
  movie: {
    id: string;
    title: string;
    poster: string;
    composer: string;
    year?: number;
  };
};

let soundtrackQueue: Queue<SoundtrackRefreshJob> | undefined;

type EnqueueSoundtrackRefreshOptions = {
  priority?: number;
  selected?: boolean;
};

function getSoundtrackQueue() {
  soundtrackQueue ??= new Queue<SoundtrackRefreshJob>(SOUNDTRACK_QUEUE_NAME, {
    connection: createBullMqConnection("queue"),
    prefix: BULLMQ_PREFIX,
    defaultJobOptions: {
      attempts: 3,
      backoff: { type: "exponential", delay: 2_000 },
      removeOnComplete: 100,
      removeOnFail: 500,
    },
  });

  return soundtrackQueue;
}

export function enqueueSoundtrackRefresh(
  movie: SoundtrackRefreshJob["movie"],
  options: EnqueueSoundtrackRefreshOptions = {}
) {
  const selectedWindow = Math.floor(Date.now() / 30_000);
  const jobId = options.selected ? `refresh-selected-${movie.id}-${selectedWindow}` : `refresh-${movie.id}`;
  return getSoundtrackQueue().add("refresh", { movie }, { jobId, priority: options.priority ?? 10 });
}

export function isSoundtrackRefreshJob(job: Job<unknown>): boolean {
  return job.name === "refresh" && typeof job.data === "object" && job.data !== null && "movie" in job.data;
}

export async function closeSoundtrackQueue() {
  await soundtrackQueue?.close();
  soundtrackQueue = undefined;
}
