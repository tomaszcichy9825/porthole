import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

import type { Reachability, ServerConfig } from '@/lib/frigate';
import { resolveServer } from '@/lib/frigate';

type StreamQuality = 'sub' | 'main';

type ServersState = {
  servers: ServerConfig[];
  activeId: string | null;
  // Runtime-only: which address answered last, per server id.
  reachability: Record<string, Reachability | null>;
  gridQuality: StreamQuality;
  fullscreenQuality: StreamQuality;
  addServer: (s: Omit<ServerConfig, 'id'>) => string;
  removeServer: (id: string) => void;
  setActive: (id: string) => void;
  setQuality: (which: 'grid' | 'fullscreen', q: StreamQuality) => void;
  refreshReachability: (id: string) => Promise<Reachability | null>;
};

export const useServers = create<ServersState>()(
  persist(
    (set, get) => ({
      servers: [],
      activeId: null,
      reachability: {},
      gridQuality: 'sub',
      fullscreenQuality: 'main',

      addServer: (s) => {
        const id = `srv-${Date.now().toString(36)}`;
        set((st) => ({
          servers: [...st.servers, { ...s, id }],
          activeId: st.activeId ?? id,
        }));
        return id;
      },

      removeServer: (id) =>
        set((st) => {
          const servers = st.servers.filter((s) => s.id !== id);
          return {
            servers,
            activeId: st.activeId === id ? (servers[0]?.id ?? null) : st.activeId,
          };
        }),

      setActive: (id) => set({ activeId: id }),

      setQuality: (which, q) =>
        set(which === 'grid' ? { gridQuality: q } : { fullscreenQuality: q }),

      refreshReachability: async (id) => {
        const server = get().servers.find((s) => s.id === id);
        if (!server) return null;
        const r = await resolveServer(server);
        set((st) => ({ reachability: { ...st.reachability, [id]: r } }));
        return r;
      },
    }),
    {
      name: 'porthole-servers',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (s) => ({
        servers: s.servers,
        activeId: s.activeId,
        gridQuality: s.gridQuality,
        fullscreenQuality: s.fullscreenQuality,
      }),
    },
  ),
);

export const useActiveServer = () => {
  const { servers, activeId, reachability } = useServers();
  const server = servers.find((s) => s.id === activeId) ?? null;
  const reach = server ? (reachability[server.id] ?? null) : null;
  // Until a probe has run, optimistically use the local address.
  const baseUrl = reach?.url ?? server?.localUrl ?? null;
  return { server, baseUrl, reach };
};
