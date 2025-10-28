let cachedBaseUrl: string | null = null;
let warnedAboutFallback = false;

function tryNormalizeUrl(candidate: string, base?: string): string | null {
  try {
    return new URL(candidate, base).toString().replace(/\/+$/, "");
  } catch {
    return null;
  }
}

function resolveWindowOrigin(): string | null {
  if (typeof window === "undefined") {
    return null;
  }
  const origin = window.location?.origin;
  return origin ? origin.replace(/\/+$/, "") : null;
}

export function resolveApiBaseUrl(): string {
  if (cachedBaseUrl) {
    return cachedBaseUrl;
  }

  const rawEnv = import.meta.env.VITE_API_URL;

  if (typeof rawEnv === "string" && rawEnv.trim()) {
    const trimmed = rawEnv.trim();
    const absolute = tryNormalizeUrl(trimmed);
    if (absolute) {
      cachedBaseUrl = absolute;
      return cachedBaseUrl;
    }
    const windowOrigin = resolveWindowOrigin();
    if (windowOrigin) {
      const relative = tryNormalizeUrl(trimmed, windowOrigin);
      if (relative) {
        cachedBaseUrl = relative;
        return cachedBaseUrl;
      }
    }
    throw new Error(
      `Invalid VITE_API_URL value "${rawEnv}". Provide an absolute URL (or a relative URL starting with "/" or "./") to your backend.`
    );
  }

  const fallback = resolveWindowOrigin();
  if (fallback) {
    if (!warnedAboutFallback) {
      console.warn(
        `[api] VITE_API_URL is not configured; falling back to window origin ${fallback}. Set VITE_API_URL to your backend base URL to avoid 404 responses.`
      );
      warnedAboutFallback = true;
    }
    cachedBaseUrl = fallback;
    return cachedBaseUrl;
  }

  throw new Error(
    "Unable to resolve API base URL. Configure VITE_API_URL or ensure window.origin is available."
  );
}

export function buildApiUrl(path: string): string {
  const baseUrl = resolveApiBaseUrl();
  const trimmedPath = path.startsWith("/") ? path.slice(1) : path;
  return `${baseUrl}/${trimmedPath}`;
}
