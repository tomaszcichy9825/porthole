import { useQuery } from '@tanstack/react-query';
import { useMemo } from 'react';

import type { EventsQuery } from '@/lib/frigate';
import { createClient } from '@/lib/frigate';
import { useActiveServer } from '@/stores/servers';

export const useFrigate = () => {
  const { server, baseUrl } = useActiveServer();
  return useMemo(
    () => (baseUrl ? createClient(baseUrl, server?.rtspPort) : null),
    [baseUrl, server?.rtspPort],
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

export const useRecordingSegments = (camera: string | undefined, after: number, before: number) => {
  const fg = useFrigate();
  return useQuery({
    queryKey: ['recordings', fg?.api, camera, Math.floor(after / 60), Math.floor(before / 60)],
    queryFn: () => fg!.getRecordingSegments(camera!, after, before),
    enabled: !!fg && !!camera,
    staleTime: 30_000,
  });
};
