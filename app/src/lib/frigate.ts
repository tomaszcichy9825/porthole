// Typed client for Frigate's HTTP API plus stream URL builders.
// Endpoint paths verified against a live Frigate 0.17.2 OpenAPI spec;
// see docs/design-feasibility.md in the repo root.

export type ServerConfig = {
  id: string;
  name: string;
  localUrl: string;
  remoteUrl?: string;
  rtspPort?: number;
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

export type StorageInfo = Record<string, { bandwidth: number; usage: number; usage_percent: number }>;

const hostOf = (baseUrl: string): string =>
  baseUrl.replace(/^[a-z]+:\/\//i, '').replace(/[:/].*$/, '');

export function createClient(baseUrl: string, rtspPort = 8554) {
  const api = baseUrl.replace(/\/$/, '');
  const rtspHost = `${hostOf(api)}:${rtspPort}`;

  const j = async <T>(path: string, init?: RequestInit): Promise<T> => {
    const r = await fetch(`${api}${path}`, init);
    if (!r.ok) throw new Error(`Frigate ${path} → ${r.status}`);
    return r.json() as Promise<T>;
  };

  return {
    api,
    getVersion: async () => {
      const r = await fetch(`${api}/api/version`);
      if (!r.ok) throw new Error(`Frigate /api/version → ${r.status}`);
      return r.text();
    },
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

    getStorage: () => j<StorageInfo>('/api/recordings/storage'),
    getPtzInfo: (camera: string) => j<{ features?: string[]; presets?: string[] }>(`/api/${camera}/ptz/info`),

    // --- URLs handed to native players and <Image> ---
    liveRtspUrl: (camera: string, sub = false) => `rtsp://${rtspHost}/${camera}${sub ? '_sub' : ''}`,
    recordingHlsUrl: (camera: string, startEpoch: number, endEpoch: number) =>
      `${api}/vod/${camera}/start/${Math.floor(startEpoch)}/end/${Math.floor(endEpoch)}/master.m3u8`,
    clipUrl: (camera: string, startEpoch: number, endEpoch: number) =>
      `${api}/api/${camera}/start/${Math.floor(startEpoch)}/end/${Math.floor(endEpoch)}/clip.mp4`,
    eventClipUrl: (id: string) => `${api}/api/events/${id}/clip.mp4`,
    eventThumbUrl: (id: string) => `${api}/api/events/${id}/thumbnail.jpg`,
    snapshotUrl: (camera: string, height?: number) =>
      `${api}/api/${camera}/latest.jpg${height ? `?h=${height}` : ''}`,
    recordingFrameUrl: (camera: string, frameTime: number) =>
      `${api}/api/${camera}/recordings/${Math.floor(frameTime)}/snapshot.jpg`,
  };
}

export type FrigateClient = ReturnType<typeof createClient>;

export type Reachability = { url: string; kind: 'local' | 'remote'; ms: number };

// Ping both configured addresses; prefer local when it answers.
export async function resolveServer(s: ServerConfig, timeoutMs = 4000): Promise<Reachability | null> {
  const probe = async (url: string, kind: 'local' | 'remote'): Promise<Reachability | null> => {
    const t0 = Date.now();
    try {
      const ctrl = new AbortController();
      const timer = setTimeout(() => ctrl.abort(), timeoutMs);
      const r = await fetch(`${url.replace(/\/$/, '')}/api/version`, { signal: ctrl.signal });
      clearTimeout(timer);
      return r.ok ? { url: url.replace(/\/$/, ''), kind, ms: Date.now() - t0 } : null;
    } catch {
      return null;
    }
  };
  const local = await probe(s.localUrl, 'local');
  if (local) return local;
  if (s.remoteUrl) return probe(s.remoteUrl, 'remote');
  return null;
}
