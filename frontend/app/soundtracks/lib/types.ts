export interface Track {
  id: string;
  title: string;
  artist: string;
  duration: string;
  musicbrainzRecordingId?: string;
  musicbrainzReleaseId?: string;
  musicbrainzArtistId?: string;
  youtubeVideoId?: string;
  previewUrl?: string;
}

export interface Soundtrack {
  soundtrackId?: string;
  movieId: number;
  movieTitle: string;
  poster: string;
  composer: string;
  tracks: Track[];
  tracksPending?: boolean;
  musicbrainzReleaseId?: string;
  musicbrainzReleaseName?: string;
  youtubeUrl?: string;
}

export interface SoundtrackQuery {
  search: string;
  page: number;
  selectedId: number | null;
}

export interface SoundtrackPage {
  items: Soundtrack[];
  page: number;
  pageSize: number;
  hasMore: boolean;
}
