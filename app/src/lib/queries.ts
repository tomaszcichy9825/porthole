import { useQuery } from '@tanstack/react-query';
import { useMemo } from 'react';

import type { EventsQuery } from '@/lib/frigate';
import { createClient } from '@/lib/frigate';
import { useActiveServer, useServers } from '@/stores/servers';

export const useFrigate = () => {
  const { server, baseUrl } = useActiveServer();
  const id = server?.id;
  return useMemo(
    () =>
      baseUrl && id
        ? createClient(
            baseUrl,
            server?.rtspPort,
            () => useServers.getState().tokens[id] ?? null,
            () => useServers.getState().ensureAuth(id),
          )
        : null,
    [baseUrl, id, server?.rtspPort],
  );
};

export const useConfig = () => {
  const fg = useFrigate();
  return useQuery({
    queryKey: ['config', fg?.api],
    queryFn: () => fg!.getConfig(),
    enabled: !!fg,
    staleTime: 60_000,
  });
};

export const useCameras = () => {
  const cfg = useConfig();
  const cameras = useMemo(
    () => Object.keys(cfg.data?.cameras ?? {}).filter((c) => cfg.data?.cameras[c]?.enabled !== false),
    [cfg.data],
  );
  return { ...cfg, cameras };
};

export const useEvents = (params: EventsQuery) => {
  const fg = useFrigate();
  return useQuery({
    queryKey: ['events', fg?.api, params],
    queryFn: () => fg!.getEvents(params),
    enabled: !!fg,
    refetchInterval: 30_000,
  });
};

export const useEvent = (id: string) => {
  const fg = useFrigate();
  return useQuery({
    queryKey: ['event', fg?.api, id],
    queryFn: () => fg!.getEvent(id),
    enabled: !!fg && !!id,
  });
};

// Previews are optional (older Frigate, or `record.preview` disabled), so a
// failure resolves to an empty list and the scrubber falls back to stills.
export const usePreviews = (camera: string | undefined, after: number, before: number) => {
  const fg = useFrigate();
  return useQuery({
    queryKey: ['previews', fg?.api, camera, Math.floor(after / 300), Math.floor(before / 300)],
    queryFn: () => fg!.getPreviews(camera!, after, before).catch(() => []),
    enabled: !!fg && !!camera,
    staleTime: 60_000,
    retry: false,
  });
};

// About 240 buckets across the window, whatever its length; Frigate's
// minimum bucket is 30 s. Optional like previews: no data, no bars.
export const useMotion = (camera: string | undefined, after: number, before: number) => {
  const fg = useFrigate();
  const scale = Math.max(30, Math.round((before - after) / 600));
  return useQuery({
    queryKey: ['motion', fg?.api, camera, scale, Math.floor(after / scale), Math.floor(before / scale)],
    queryFn: () => fg!.getMotionActivity(camera!, after, before, scale).catch(() => []),
    enabled: !!fg && !!camera,
    staleTime: 60_000,
    retry: false,
  });
};

export const useRecordingSegments =(camera: string | undefined, after: number, before: number) => {
  const fg = useFrigate();
  return useQuery({
    queryKey: ['recordings', fg?.api, camera, Math.floor(after / 60), Math.floor(before / 60)],
    queryFn: () => fg!.getRecordingSegments(camera!, after, before),
    enabled: !!fg && !!camera,
    staleTime: 30_000,
  });
};
