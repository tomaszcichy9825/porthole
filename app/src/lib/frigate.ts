// Typed client for Frigate's HTTP API plus stream URL builders.
// Endpoint paths verified against a live Frigate 0.17.2 OpenAPI spec;
// see docs/design-feasibility.md in the repo root.
//
// Two doors into Frigate: the unauthenticated internal API (http, :5000,
// LAN/tailnet only) and the authenticated TLS port (:8971 or a domain
// fronting it), which wants a frigate_token JWT cookie from POST /api/login.
// The client attaches the cookie to its own fetches and exposes the same
// headers for native players and <Image>, which manage their own requests.

export type ServerConfig = {
  id: string;
  name: string;
  localUrl: string;
  remoteUrl?: string;
  rtspPort?: number;
  username?: string;
};

export type CameraConfig = {
  name: string;
  enabled?: boolean;
  detect?: { width: number; height: number; fps?: number };
  onvif?: { host?: string };
};

export type CameraGroup = { cameras: string[]; icon?: string; order?: number };

export type FrigateConfig = {
  cameras: Record<string, CameraConfig>;
  camera_groups?: Record<string, CameraGroup>;
};

export type FrigateEvent = {
  id: string;
  camera: string;
  label: string;
  sub_label?: string | null;
  start_time: number;
  end_time: number | null;
  zones: string[];
  has_clip: boolean;
  has_snapshot: boolean;
  data?: { score?: number; top_score?: number; recognized_license_plate?: string };
  top_score?: number;
};

export type EventsQuery = {
  camera?: string;
  label?: string;
  zones?: string;
  before?: number;
  after?: number;
  limit?: number;
  has_clip?: 0 | 1;
};

export type RecordingSegment = { start_time: number; end_time: number; duration: number };

// Low-res, low-fps proxy clips Frigate generates alongside recordings. The
// Frigate UI scrubs against these rather than the recordings themselves:
// one clip is fetched once, then every scrub is a local seek.
export type PreviewClip = { camera: string; src: string; type: string; start: number; end: number };

// Motion per `scale`-second bucket, what the Frigate UI draws behind its
// timeline. `motion` is Frigate's activity score for the bucket.
export type MotionBucket = { start_time: number; motion: number; camera: string };

export type StorageInfo =Record<string, { bandwidth: number; usage: number; usage_percent: number }>;

const hostOf = (baseUrl: string): string =>
  baseUrl.replace(/^[a-z]+:\/\//i, '').replace(/[:/].*$/, '');

export class AuthError extends Error {
  constructor(status: number) {
    super(`Frigate rejected the request (${status}) - login required or expired`);
    this.name = 'AuthError';
  }
}

export async function login(baseUrl: string, user: string, password: string): Promise<string> {
  const r = await fetch(`${baseUrl.replace(/\/$/, '')}/api/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ user, password }),
  });
  if (!r.ok) throw new Error(`Login failed (${r.status})`);
  const setCookie = r.headers.get('set-cookie') ?? '';
  const m = setCookie.match(/frigate_token=([^;,\s]+)/);
  if (!m) throw new Error('Login succeeded but no frigate_token cookie came back');
  return m[1];
}

// `token` may be a getter so a re-minted JWT is picked up without rebuilding
// the client; `onAuthError` runs once on 401/403 (re-login), then the request
// is retried. Frigate sessions expire after a day, so a long-lived app
// session needs this to keep working.
export function createClient(
  baseUrl: string,
  rtspPort = 8554,
  token?: string | null | (() => string | null),
  onAuthError?: () => Promise<void>,
) {
  const api = baseUrl.replace(/\/$/, '');
  const rtspHost = `${hostOf(api)}:${rtspPort}`;
  const tokenNow = () => (typeof token === 'function' ? token() : token) ?? null;
  // Same shape for fetch, expo-image sources and expo-video sources.
  // Bearer first: iOS URLSession manages cookies itself and can drop a
  // manually set Cookie header; Frigate accepts either.
  const headersFor = (t: string | null): Record<string, string> =>
    t ? { Authorization: `Bearer ${t}`, Cookie: `frigate_token=${t}` } : {};

  const raw = async (path: string, init?: RequestInit, retried = false): Promise<Response> => {
    const r = await fetch(`${api}${path}`, { ...init, headers: { ...headersFor(tokenNow()), ...init?.headers } });
    if (r.status === 401 || r.status === 403) {
      if (onAuthError && !retried) {
        await onAuthError();
        return raw(path, init, true);
      }
      throw new AuthError(r.status);
    }
    if (!r.ok) throw new Error(`Frigate ${path} → ${r.status}`);
    return r;
  };
  const j = <T>(path: string, init?: RequestInit): Promise<T> => raw(path, init).then((r) => r.json() as Promise<T>);

  return {
    api,
    get authHeaders() {
      return headersFor(tokenNow());
    },
    getVersion: () => raw('/api/version').then((r) => r.text()),
    getConfig: () => j<FrigateConfig>('/api/config'),

    getEvents: (p: EventsQuery = {}) => {
      const q = new URLSearchParams();
      Object.entries(p).forEach(([k, v]) => v != null && q.append(k, String(v)));
      return j<FrigateEvent[]>(`/api/events?${q.toString()}`);
    },
    getEvent: (id: string) => j<FrigateEvent>(`/api/events/${id}`),
    deleteEvent: (id: string) => j<unknown>(`/api/events/${id}`, { method: 'DELETE' }),

    // Recorded ranges for the timeline. `after`/`before` are epoch seconds.
    getRecordingSegments: (camera: string, after: number, before: number) =>
      j<RecordingSegment[]>(`/api/${camera}/recordings?after=${Math.floor(after)}&before=${Math.floor(before)}`),
    getRecordingsSummary: (camera: string) => j<unknown>(`/api/${camera}/recordings/summary`),

    // 404s when the camera has no previews cached for the range.
    getPreviews: (camera: string, after: number, before: number) =>
      j<PreviewClip[]>(`/api/preview/${camera}/start/${Math.floor(after)}/end/${Math.ceil(before)}`),

    getMotionActivity: (camera: string, after: number, before: number, scale: number) =>
      j<MotionBucket[]>(
        `/api/review/activity/motion?cameras=${camera}&after=${Math.floor(after)}&before=${Math.ceil(before)}&scale=${Math.round(scale)}`,
      ),

    getStorage: () => j<StorageInfo>('/api/recordings/storage'),
    getPtzInfo: (camera: string) => j<{ features?: string[]; presets?: string[] }>(`/api/${camera}/ptz/info`),

    // --- URLs handed to native players and <Image>; pair with authHeaders ---
    liveRtspUrl: (camera: string, sub = false) => `rtsp://${rtspHost}/${camera}${sub ? '_sub' : ''}`,
    recordingHlsUrl: (camera: string, startEpoch: number, endEpoch: number) =>
      `${api}/vod/${camera}/start/${Math.floor(startEpoch)}/end/${Math.floor(endEpoch)}/master.m3u8`,
    clipUrl: (camera: string, startEpoch: number, endEpoch: number) =>
      `${api}/api/${camera}/start/${Math.floor(startEpoch)}/end/${Math.floor(endEpoch)}/clip.mp4`,
    eventClipUrl: (id: string) => `${api}/api/events/${id}/clip.mp4`,
    eventThumbUrl: (id: string) => `${api}/api/events/${id}/thumbnail.jpg`,
    snapshotUrl: (camera: string, height?: number) =>
      `${api}/api/${camera}/latest.jpg${height ? `?h=${height}` : ''}`,
    // `src` comes back from the preview API as a server-absolute path.
    previewUrl: (src: string) => `${api}${src.startsWith('/') ? src : `/${src}`}`,
    recordingFrameUrl: (camera: string, frameTime: number) =>
      `${api}/api/${camera}/recordings/${Math.floor(frameTime)}/snapshot.jpg`,
  };
}

export type FrigateClient = ReturnType<typeof createClient>;

export type Reachability = { url: string; kind: 'local' | 'remote'; ms: number };

// Ping both configured addresses; prefer local when it answers. A 401 still
// proves the server is there, so it counts as reachable.
export async function resolveServer(s: ServerConfig, timeoutMs = 4000): Promise<Reachability | null> {
  const probe = async (url: string, kind: 'local' | 'remote'): Promise<Reachability | null> => {
    const t0 = Date.now();
    try {
      const ctrl = new AbortController();
      const timer = setTimeout(() => ctrl.abort(), timeoutMs);
      const r = await fetch(`${url.replace(/\/$/, '')}/api/version`, { signal: ctrl.signal });
      clearTimeout(timer);
      return r.ok || r.status === 401 || r.status === 403
        ? { url: url.replace(/\/$/, ''), kind, ms: Date.now() - t0 }
        : null;
    } catch {
      return null;
    }
  };
  const local = await probe(s.localUrl, 'local');
  if (local) return local;
  if (s.remoteUrl) return probe(s.remoteUrl, 'remote');
  return null;
}
