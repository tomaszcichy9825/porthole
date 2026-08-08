import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

import type { Reachability, ServerConfig } from '@/lib/frigate';
import { login, resolveServer } from '@/lib/frigate';

type StreamQuality = 'sub' | 'main';

// Passwords live in the Keychain/Keystore only; JWTs stay in memory and are
// re-minted from the stored credentials whenever needed.
const credKey = (id: string) => `porthole.cred.${id.replace(/[^A-Za-z0-9._-]/g, '')}`;

export async function saveCredentials(id: string, user: string, password: string) {
  await SecureStore.setItemAsync(credKey(id), JSON.stringify({ user, password }));
}

export async function loadCredentials(id: string): Promise<{ user: string; password: string } | null> {
  const raw = await SecureStore.getItemAsync(credKey(id));
  return raw ? JSON.parse(raw) : null;
}

export async function deleteCredentials(id: string) {
  await SecureStore.deleteItemAsync(credKey(id));
}

type ServersState = {
  servers: ServerConfig[];
  activeId: string | null;
  // Runtime-only per server id: which address answered, and the session JWT.
  reachability: Record<string, Reachability | null>;
  tokens: Record<string, string | null>;
  gridQuality: StreamQuality;
  fullscreenQuality: StreamQuality;
  addServer: (s: Omit<ServerConfig, 'id'>) => string;
  removeServer: (id: string) => void;
  setActive: (id: string) => void;
  setQuality: (which: 'grid' | 'fullscreen', q: StreamQuality) => void;
  setToken: (id: string, token: string | null) => void;
  refreshReachability: (id: string) => Promise<Reachability | null>;
  // Mint a fresh JWT from stored credentials; no-op for cred-less servers.
  ensureAuth: (id: string) => Promise<void>;
};

export const useServers = create<ServersState>()(
  persist(
    (set, get) => ({
      servers: [],
      activeId: null,
      reachability: {},
      tokens: {},
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
          deleteCredentials(id).catch(() => {});
          const servers = st.servers.filter((s) => s.id !== id);
          return {
            servers,
            activeId: st.activeId === id ? (servers[0]?.id ?? null) : st.activeId,
          };
        }),

      setActive: (id) => set({ activeId: id }),

      setQuality: (which, q) =>
        set(which === 'grid' ? { gridQuality: q } : { fullscreenQuality: q }),

      setToken: (id, token) => set((st) => ({ tokens: { ...st.tokens, [id]: token } })),

      refreshReachability: async (id) => {
        const server = get().servers.find((s) => s.id === id);
        if (!server) return null;
        const r = await resolveServer(server);
        set((st) => ({ reachability: { ...st.reachability, [id]: r } }));
        if (r && server.username) await get().ensureAuth(id);
        return r;
      },

      ensureAuth: async (id) => {
        const st = get();
        const server = st.servers.find((s) => s.id === id);
        if (!server?.username) return;
        const base = st.reachability[id]?.url ?? server.localUrl;
        const creds = await loadCredentials(id);
        if (!creds) return;
        try {
          const token = await login(base, creds.user, creds.password);
          st.setToken(id, token);
        } catch {
          st.setToken(id, null);
        }
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
  const { servers, activeId, reachability, tokens } = useServers();
  const server = servers.find((s) => s.id === activeId) ?? null;
  const reach = server ? (reachability[server.id] ?? null) : null;
  // Until a probe has run, optimistically use the local address.
  const baseUrl = reach?.url ?? server?.localUrl ?? null;
  const token = server ? (tokens[server.id] ?? null) : null;
  return { server, baseUrl, reach, token };
};
