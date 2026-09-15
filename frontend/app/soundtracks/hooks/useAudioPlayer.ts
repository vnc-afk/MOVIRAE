"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { Track } from "../lib/types";

declare global {
  interface Window {
    YT?: { Player: new (element: HTMLElement, options: { videoId?: string; playerVars?: Record<string, number | string>; events?: Record<string, (event: { target: YTPlayer; data?: number }) => void> }) => YTPlayer };
    onYouTubeIframeAPIReady?: () => void;
  }
}

interface YTPlayer {
  loadVideoById(videoId: string): void;
  playVideo(): void;
  pauseVideo(): void;
  stopVideo(): void;
  seekTo(seconds: number, allowSeekAhead: boolean): void;
  getCurrentTime(): number;
  getDuration(): number;
  destroy(): void;
}

export function useAudioPlayer(movieId: number | null, tracks: Track[]) {
  const playerRef = useRef<YTPlayer | null>(null);
  const playerReadyRef = useRef(false);
  const playerReadyPromiseRef = useRef<Promise<YTPlayer> | null>(null);
  const resolvePlayerReadyRef = useRef<((player: YTPlayer) => void) | null>(null);
  const playerContainerRef = useRef<HTMLDivElement | null>(null);
  const playRequestRef = useRef(0);
  const activeTrackIdRef = useRef<string | null>(null);
  const [trackId, setTrackId] = useState<string | null>(null);
  const [currentTrack, setCurrentTrack] = useState<Track | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);

  const sanitizePlaybackValue = useCallback((value: number | null | undefined): number => {
    return Number.isFinite(value) ? (value as number) : 0;
  }, []);
  const [error, setError] = useState<string | null>(null);
  const [resolvedVideoIds, setResolvedVideoIds] = useState<Record<string, string>>({});

  useEffect(() => {
    let cancelled = false;
    playerReadyRef.current = false;
    playerReadyPromiseRef.current = new Promise((resolve) => {
      resolvePlayerReadyRef.current = resolve;
    });

    const createPlayer = () => {
      if (!cancelled && window.YT && playerContainerRef.current && !playerRef.current) {
        playerRef.current = new window.YT.Player(playerContainerRef.current, {
          playerVars: { controls: 0, playsinline: 1, enablejsapi: 1, origin: window.location.origin },
          events: {
            onReady: (event) => {
              playerReadyRef.current = true;
              resolvePlayerReadyRef.current?.(event.target);
              setDuration(sanitizePlaybackValue(event.target.getDuration()));
            },
            onStateChange: (event) => setIsPlaying(event.data === 1),
            onError: () => {
              setIsPlaying(false);
              setError("YouTube could not play this preview.");
            },
          },
        });
      }
    };
    if (window.YT) createPlayer();
    else {
      const script = document.querySelector<HTMLScriptElement>('script[src="https://www.youtube.com/iframe_api"]') ?? document.createElement("script");
      script.src = "https://www.youtube.com/iframe_api";
      if (!script.parentNode) document.head.appendChild(script);
      const previousReady = window.onYouTubeIframeAPIReady;
      window.onYouTubeIframeAPIReady = () => { previousReady?.(); createPlayer(); };
    }
    const interval = window.setInterval(() => {
      const player = playerRef.current;
      if (!player || typeof player.getCurrentTime !== "function" || typeof player.getDuration !== "function") {
        return;
      }

      const nextCurrentTime = sanitizePlaybackValue(player.getCurrentTime());
      const nextDuration = sanitizePlaybackValue(player.getDuration());

      setCurrentTime(nextCurrentTime);
      if (nextDuration > 0) {
        setDuration(nextDuration);
      }
    }, 250);
    return () => {
      cancelled = true;
      window.clearInterval(interval);
      playerReadyRef.current = false;
      resolvePlayerReadyRef.current = null;
      playerReadyPromiseRef.current = null;
      playerRef.current?.destroy();
      playerRef.current = null;
    };
  }, []);

  const waitForPlayer = useCallback(async () => {
    if (playerRef.current && playerReadyRef.current) return playerRef.current;
    const readyPromise = playerReadyPromiseRef.current;
    if (!readyPromise) return null;

    return Promise.race([
      readyPromise,
      new Promise<null>((resolve) => window.setTimeout(() => resolve(null), 8_000)),
    ]);
  }, []);

  const play = useCallback(async (nextTrackId: string) => {
    const nextTrack = tracks.find((track) => track.id === nextTrackId);
    if (!nextTrack) return false;
    const previousTrackId = activeTrackIdRef.current;
    const playRequest = ++playRequestRef.current;
    const isLatestRequest = () => playRequest === playRequestRef.current;
    activeTrackIdRef.current = nextTrackId;
    if (previousTrackId && previousTrackId !== nextTrackId) {
      playerRef.current?.stopVideo();
      setIsPlaying(false);
    }
    setError(null);
    setTrackId(nextTrackId);
    setCurrentTrack(nextTrack);
    try {
      const player = await waitForPlayer();
      if (!isLatestRequest()) return false;
      if (!player) throw new Error("Audio player is still loading. Please try again.");

      let youtubeVideoId = nextTrack.youtubeVideoId ?? resolvedVideoIds[nextTrackId];
      if (!youtubeVideoId) {
        if (movieId === null) throw new Error("No playable preview was found.");
        const response = await fetch(`/api/soundtracks/${movieId}/tracks/${encodeURIComponent(nextTrack.id)}/youtube`);
        if (!response.ok) {
          const payload = await response.json().catch(() => null) as { error?: { message?: string } } | null;
          throw new Error(payload?.error?.message ?? "No playable preview was found.");
        }
        const payload = await response.json() as { data?: { youtubeVideoId?: string } };
        const resolvedVideoId = payload.data?.youtubeVideoId;
        if (!resolvedVideoId) throw new Error("No playable preview was found.");
        youtubeVideoId = resolvedVideoId;
        setResolvedVideoIds((current) => ({ ...current, [nextTrackId]: resolvedVideoId }));
      }
      if (!isLatestRequest()) return false;
      if (!youtubeVideoId) throw new Error("No playable preview was found.");
      player.loadVideoById(youtubeVideoId);
      player.playVideo();
      setCurrentTime(0);
      setDuration(0);
    } catch (cause) {
      if (!isLatestRequest()) return false;
      setIsPlaying(false);
      setError(cause instanceof Error ? cause.message : "Unable to play this preview.");
      return false;
    }
    setIsPlaying(true);
    return true;
  }, [movieId, resolvedVideoIds, tracks, waitForPlayer]);

  const toggle = useCallback(async (nextTrackId: string) => {
    const player = await waitForPlayer();
    if (trackId === nextTrackId && player) {
      if (isPlaying) {
        player.pauseVideo();
        setIsPlaying(false);
      } else {
        player.playVideo();
        setIsPlaying(true);
      }
      return Boolean(currentTrack?.youtubeVideoId ?? (currentTrack && resolvedVideoIds[currentTrack.id]));
    }
    return play(nextTrackId);
  }, [currentTrack?.id, currentTrack?.youtubeVideoId, isPlaying, play, resolvedVideoIds, trackId, waitForPlayer]);

  const stop = useCallback(() => {
    playRequestRef.current += 1;
    activeTrackIdRef.current = null;
    playerRef.current?.stopVideo();
    setTrackId(null);
    setCurrentTrack(null);
    setIsPlaying(false);
    setError(null);
  }, []);

  const seek = useCallback((value: number) => {
    playerRef.current?.seekTo(value, true);
    setCurrentTime(value);
  }, []);

  const skip = useCallback((seconds: number) => {
    if (playerRef.current) seek(Math.max(0, Math.min(playerRef.current.getDuration() || 0, playerRef.current.getCurrentTime() + seconds)));
  }, [seek]);

  return { currentTrack, trackId, isPlaying, currentTime, duration, error, toggle, play, stop, seek, skip, playerContainerRef };
}
