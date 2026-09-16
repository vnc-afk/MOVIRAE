import "server-only";

const GIPHY_API_URL = "https://api.giphy.com/v1/gifs";
const GIPHY_API_KEY = process.env.GIPHY_API_KEY;
const GIPHY_TIMEOUT_MS = 8000;

export class GiphyRequestError extends Error {
  constructor(public readonly status: number, message: string) {
    super(message);
    this.name = "GiphyRequestError";
  }
}

export type GifMetadata = {
  id: string;
  title: string;
  url: string;
  previewUrl: string;
  width: number;
  height: number;
};

type GiphyImage = { url?: string; width?: string; height?: string };
type GiphyGif = {
  id?: string;
  title?: string;
  url?: string;
  images?: { fixed_width?: GiphyImage; fixed_width_small?: GiphyImage };
};

function normalizeGif(gif: GiphyGif): GifMetadata | null {
  const image = gif.images?.fixed_width;
  const preview = gif.images?.fixed_width_small ?? image;
  if (!gif.id || !image?.url || !preview?.url) return null;

  return {
    id: gif.id,
    title: gif.title?.trim() || "GIF",
    url: image.url,
    previewUrl: preview.url,
    width: Number(image.width) || 200,
    height: Number(image.height) || 200,
  };
}

async function giphyRequest(path: string) {
  if (!GIPHY_API_KEY) throw new Error("GIPHY_API_KEY is not configured");

  const url = `${GIPHY_API_URL}${path}${path.includes("?") ? "&" : "?"}api_key=${encodeURIComponent(GIPHY_API_KEY)}`;
  let lastError: unknown;

  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      const response = await fetch(url, {
        headers: { Accept: "application/json" },
        signal: AbortSignal.timeout(GIPHY_TIMEOUT_MS),
      });

      if (!response.ok) {
        throw new GiphyRequestError(response.status, `GIPHY request failed (${response.status})`);
      }

      return response.json() as Promise<{ data?: GiphyGif | GiphyGif[] }>;
    } catch (error) {
      lastError = error;
      const isRetryable = error instanceof GiphyRequestError
        ? error.status >= 500
        : (error as Error).name === "TimeoutError" || (error as Error).name === "AbortError";
      if (!isRetryable || attempt === 1) throw error;
    }
  }

  throw lastError;
}

export async function searchGifs(query: string, limit = 24) {
  const data = await giphyRequest(`/search?q=${encodeURIComponent(query)}&limit=${limit}&rating=pg-13&lang=en`);
  return (Array.isArray(data.data) ? data.data : []).map(normalizeGif).filter((gif): gif is GifMetadata => Boolean(gif));
}

export async function getGifById(id: string) {
  const data = await giphyRequest(`/${encodeURIComponent(id)}`);
  return normalizeGif(Array.isArray(data.data) ? {} : data.data ?? {});
}
