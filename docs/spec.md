# Porthole — Product Specification

**Name:** Porthole (store listing: "Porthole for Frigate")
**Author:** Tomasz + Claude
**Status:** Draft v0.2
**Last updated:** 2026-08-07

---

## 1. Problem & Vision

### The problem

Frigate NVR is excellent, but its **only first-party client is a browser web UI**. Browsers decode video through the MSE/WebCodecs pipeline, which chokes on high-resolution H.264/H.265 (2880×1616) footage: playback stutters, fast-forward throws decode errors, and reviewing recordings freezes the tab. This is a *client decode* problem, not a server, disk, or network problem (measured: drive reads 46 MB/s, LAN delivers 530 Mbps, server serves clips fine; the browser is the sole bottleneck).

Existing native apps (Lumen, ViewPane, Viewu, Kapal) are all **less than a year old, beta-quality, mostly iOS-only**, and none nail the cross-platform + recordings-scrubbing + polish combination.

### The vision

A **fast, native, cross-platform Frigate client** that:

- Decodes video with the phone's **hardware decoder** (ExoPlayer / AVPlayer / libVLC), never a browser.
- Makes **reviewing recordings** (scrub / rewind / jump-to-time) buttery, which is where the web UI hurts most.
- Is **local-first and private**: talks directly to the user's Frigate over LAN / Tailscale / WireGuard. No cloud relay for video, ever.
- Supports **H.265** natively (half the storage and bandwidth vs H.264).
- Ships to **Google Play + Apple App Store** from one Expo/React Native codebase.

### One-line positioning

> "The native Frigate app that doesn't freeze — live view and instant-rewind recordings, hardware-decoded, no cloud."

---

## 2. Target Users

| Segment | Need |
|---|---|
| Self-hosted Frigate users (r/frigate, HA community) | A phone app that's faster and nicer than the PWA |
| Privacy-conscious users | No cloud, no account required for core use, data stays on their network |
| Non-technical household members | "Just show me the cameras and let me rewind" — simple, no HA needed |
| Power users | Multi-server, multi-camera grids, event filtering, H.265 |

**Key differentiator vs competitors:** true cross-platform (Android **and** iOS from day one), recordings scrubbing that actually works, and a polished, non-beta feel.

---

## 3. Platforms & Scope

| Platform | v1 | Mechanism |
|---|---|---|
| **Android** (phone/tablet) | ✅ | Expo / RN, EAS Build |
| **iOS** (iPhone/iPad) | ✅ | Expo / RN, EAS Build |
| **macOS** | 🔜 nice-to-have | iOS app running on Apple Silicon ("Designed for iPad") — free bonus, low effort |
| Android TV / tvOS | ❄️ later | live-grid mode |
| Web | ❌ | that's the thing we're replacing |

**Primary store targets:** Google Play + Apple App Store.

---

## 4. Feature Set

### 4.1 MVP (v1.0 — the thing that justifies existing)

> **MVP explicitly excludes push notifications** — deferred to v1.1 (§8). The MVP is a pure viewer: connect, watch live, scrub recordings, browse events.

- **Server onboarding:** add a Frigate server by URL (`http://host:5000`), optional name, test-connection. Store multiple servers.
- **Camera list / live grid:** pull cameras from `/api/config`; live view via RTSP restream; 1/2/3-column grid; tap to fullscreen.
- **Live view:** hardware-decoded RTSP (main or sub stream toggle), pinch-zoom, fullscreen, landscape.
- **Recordings player (the headline feature):** per-camera continuous recording with a **scrubbable timeline** (HLS VOD), native seek/rewind/fast-forward, jump-to-time, date picker.
- **Events list:** `/api/events` with thumbnails; filter by camera / object label / time; tap → play the event clip natively.
- **Settings:** stream quality (main/sub), theme, per-server config, cache management.
- **Connectivity:** works on LAN and over **Tailscale / WireGuard / any reachable URL** (auto-switch local↔remote by network, like the network-aware viewers).

### 4.2 v1.x (fast-follow)

- **Push notifications** (free, self-hosted bridge) — see §8.
- Snapshot download / share; clip export and share.
- PTZ controls (ONVIF, exposed by Frigate) for pan-tilt cameras.
- Face / licence-plate recognition surfacing (Frigate 0.14+ metadata).
- Widgets (latest event, camera snapshot).

### 4.3 v2+

- Multi-server unified event feed.
- Android TV / tvOS live wall.
- macOS-native polish.
- Semantic/natural-language event search (Frigate's embeddings API).
- Two-way audio (go2rtc).

### 4.4 Explicit non-goals

- Not re-implementing Frigate's server/detection — it's a **client only**.
- No cloud storage of footage.
- No account required to use core features.

---

## 5. Technical Architecture

### 5.1 Stack

- **Expo (React Native) + TypeScript** — one codebase, EAS Build/Submit (reuse existing dev account and tooling from *grasshopper*).
- **Navigation:** Expo Router (file-based) or React Navigation.
- **State/data:** TanStack Query (server cache, polling) + Zustand (app/UI state) + MMKV (fast local persistence for servers/settings).
- **Backend:** **none for core**. Optional thin cloud only for the push relay (§8). Firebase and/or Supabase already available.

### 5.2 Video pipeline (the crux — this is why it's native)

| Use case | Library | Why | Notes |
|---|---|---|---|
| **Live view** | `react-native-vlc-media-player` (libVLC) | RTSP + H.264/H.265 hardware decode, robust | Native module → requires **Expo dev build / prebuild** (not Expo Go). Config plugin. |
| **Recordings** | `expo-video` | Native ExoPlayer (Android) / AVPlayer (iOS), **HLS scrubbing** built in, HW decode | Point at Frigate's HLS VOD URL |
| *(alt live, later)* | `react-native-webrtc` + go2rtc | Lowest latency | More complex; VLC/RTSP is fine for v1 |

**Design principle:** all decoding is delegated to native players. The app never touches raw frames — no browser, no JS decode, no freeze.

### 5.3 Frigate API surface (verified against a live Frigate 0.17)

Base (LAN): `http://<host>:5000` · Remote: `http://100.x.x.x:5000` (Tailscale) — port 5000 is the unauthenticated internal API; 8971 is the authenticated HTTPS UI.

| Purpose | Endpoint | Verified |
|---|---|---|
| Server/camera config | `GET /api/config` | ✅ |
| Events (metadata + thumbs) | `GET /api/events?camera=&label=&after=&before=&limit=` | ✅ (API exists) |
| Event clip | `GET /api/events/<id>/clip.mp4` | — |
| **Recordings (HLS VOD)** | `GET /vod/<camera>/start/<epoch>/end/<epoch>/master.m3u8` | ✅ **returns valid VOD playlist, fMP4 segments, 2880×1616** |
| Recording clip (on-the-fly) | `GET /api/<camera>/start/<epoch>/end/<epoch>/clip.mp4` | ✅ (12 MB / 30 s served) |
| **Live (RTSP restream)** | `rtsp://<host>:8554/<camera>` and `/<camera>_sub` | ✅ port open |
| Live (WebRTC/MSE) | via go2rtc `:8555` / `/api/go2rtc` | — |
| Snapshot | `GET /api/<camera>/latest.jpg` | — |
| Recording availability | `GET /api/<camera>/recordings/summary` | — |
| Real-time events | MQTT topic `frigate/#` | ✅ (broker running) |

### 5.4 Connection & network model

- **Direct-to-Frigate**, no intermediary for video.
- Per-server config stores **local URL + remote URL**; app pings both and auto-selects (network-aware), or user picks.
- Remote = user's own **Tailscale/WireGuard/VPN or reverse proxy** — the app just uses whatever URL resolves. No hole-punching, no vendor cloud.
- Auth: support (a) no-auth internal API (`:5000`), (b) Frigate username/password → cookie/JWT against `:8971`, (c) optional custom headers / API key for users behind their own auth proxy. Store credentials in **Keychain/Keystore** (expo-secure-store).

---

## 6. UX / Screens

1. **Onboarding** — add server (URL, name, optional creds), test connection, QR-paste option.
2. **Home / Live grid** — camera tiles (live or snapshot-until-tapped for battery), column selector, status dots, pull-to-refresh.
3. **Camera fullscreen (Live)** — HW-decoded stream, main/sub toggle, PTZ (later), snapshot, jump-to-recordings-at-now.
4. **Recordings** — per camera: timeline scrubber + date/time picker, play/rewind/FF (2×/4×/8×), "jump to time", thumbnails on scrub (if feasible via snapshots).
5. **Events** — filterable list with thumbnails (camera, label, time, zone); tap → native clip player; swipe to delete (if permitted).
6. **Settings** — servers, default stream quality, theme (dark-first), notifications, cache, about/licensing.

**Design language:** dark-first, fast, minimal chrome; "minimal mode" for live grids (hide labels/borders) like Kapal.

---

## 7. Open Source + Monetisation

**Decision: the app is open source, fully free, no paywalls.** In this niche OSS is a *strategic advantage* — every current competitor (Lumen, ViewPane) is closed-source, and the Frigate audience is the self-hosted/privacy/anti-cloud crowd that actively prefers and boosts OSS (F-Droid, r/frigate, HA forums). OSS brings contributors, translations, auditability, and trust.

**Monetisation = donations only.** Literally: *"If you find this useful, sponsor me on GitHub."* No IAP, no subscriptions, no feature-gating, no tiers, no ads. Every feature is free for everyone.

- **[GitHub Sponsors](https://github.com/sponsors)** as the primary channel (+ optionally Ko-fi / Buy Me a Coffee link).
- A quiet, non-nagging "❤️ Support / Sponsor" entry in Settings and the README. No interstitials, no reminders.

**What this simplifies in the build:** no RevenueCat, no App Store/Play Billing, no entitlement logic, no "Pro" branching. The whole app is one free tier. Push notifications ship as a **free self-hosted bridge** (§8) — no paid relay.

### 7b. Licensing

- The app is a **separate client** talking to Frigate over its HTTP API → **not a derivative work** of Frigate, so **not bound by Frigate's AGPL-3.0.** Free choice of licence.
- **Avoid GPL/AGPL for the app** when targeting the **Apple App Store** — Apple's terms conflict with GPL; GPL apps have been pulled.
- ✅ **Chosen: MPL-2.0** (file-level copyleft — keeps our files open if forked, but App-Store-safe and lets any hosted-service code stay separate).
- Any hosted push-relay backend can be a **separate repo with its own licence**, since it's a separate service.

---

## 8. Push Notifications (free, v1.x) — the one hard piece

**Constraint:** Frigate sits behind the user's LAN/VPN with no public ingress, so a cloud service **cannot reach it**. Push must therefore originate *from the user's network*.

**Recommended architecture (privacy-preserving):**

1. A tiny **self-hosted "push bridge"** (Docker container we publish) runs on the user's network, subscribes to `frigate/events` over MQTT.
2. On a qualifying event it POSTs a **minimal notification payload** (camera, label, thumbnail URL, event id — *no video*) to a **stateless cloud relay** (Firebase Cloud Function / Supabase Edge Function).
3. Relay forwards to **FCM/APNs** using the device token the app registered.
4. Tapping the notification deep-links into the app, which fetches the clip **directly** from Frigate over the user's network.

- Video never transits our cloud; only tiny event metadata does (documented in privacy policy).
- Alternative for max-privacy users: bridge → FCM directly with a self-provided key (advanced).
- v1.0 ships **without** push; added in v1.1.

---

## 9. Security & Privacy

- All secrets in **Keychain/Keystore** (expo-secure-store); never in JS/AsyncStorage.
- HTTPS by default; allow user-trusted self-signed certs for `:8971` (opt-in per server).
- **iOS ATS:** `NSAllowsArbitraryLoads` is acceptable for the dev spike only. Production must use `NSAllowsLocalNetworking` plus scoped per-domain exceptions, with a written justification for App Store review (local-network NVR client).
- **No telemetry by default** (privacy is the brand). Optional, clearly opt-in crash reporting (Sentry) with scrubbed data.
- **Play Data Safety / App Privacy** labels: "No data collected" for the no-push path; push path discloses the metadata relay.
- Required legal: Privacy Policy + Terms (hosted), GDPR-friendly (EU users).

---

## 10. Quality, CI/CD, Release

- **EAS Build** (Android APK/AAB + iOS) and **EAS Submit** to both stores.
- **EAS Update** (OTA) for JS-only fixes.
- Channels: `development` (dev client) → `preview` (internal testers) → `production`.
- **Testing:** unit (Jest) for API client and time-range logic; Maestro/Detox E2E for connect→live→recordings→event; manual matrix on a few real cameras (H.264 and H.265, main and sub).
- Crash/error monitoring: Sentry (opt-in).
- Beta: Play **Internal testing** + Apple **TestFlight**.

---

## 11. Store Requirements (gotchas)

- **Android:** target latest API level, AAB, Data Safety form, foreground-service disclosure if live streaming in background, content rating.
- **iOS:** App Privacy questionnaire, "Designed for iPad"/Mac toggle, export compliance (uses standard HTTPS/crypto → usually exempt but must declare), no private APIs (VLC module is fine).
- **Both:** screenshots on required device sizes, support URL, privacy policy URL.

---

## 12. Naming, Branding, Legal

- **Name: Porthole.** Store listing: **"Porthole for Frigate"** (cannot use "Frigate" alone — trademark; the "<Name> for Frigate" convention matches Lumen for Frigate etc.).
- Disclaimer everywhere relevant: *"Independent third-party client, not affiliated with the Frigate project."*
- Respect Frigate's licence/branding guidelines; link to the Frigate project.

---

## 13. Risks & Open Questions

| Risk / question | Notes |
|---|---|
| RTSP live latency/stability via libVLC in RN | Prototype early; go2rtc WebRTC is the fallback |
| HLS scrub thumbnails | Frigate may not expose per-second thumbs; may approximate via snapshots or skip |
| Frigate API drift across versions (0.13→0.17→…) | Abstract an API client; capability-detect per server |
| iOS background + push reliability | APNs specifics; test thoroughly |
| Competitive crowding (Lumen/ViewPane/etc.) | Win on cross-platform + polish + recordings UX |
| macOS distribution | iOS-on-Apple-Silicon first; RN-macOS is a bigger lift |
| Support load | Docs, in-app troubleshooting, connection diagnostics |
| Recordings↔live seam | "Jump to now" crosses from HLS VOD to RTSP live; design the transition deliberately |

---

## 14. Milestones (rough)

1. **M0 — Spike:** dev build with libVLC playing one RTSP camera + `expo-video` playing one HLS recording URL. *Proves the freeze is gone.*
2. **M1 — MVP:** onboarding, live grid, recordings scrubber, events list, settings. Internal testing build.
3. **M2 — Beta:** multi-server, network-aware URLs, polish, TestFlight/Play internal.
4. **M3 — v1.0 launch:** store listings, privacy policy, screenshots, submit.
5. **M4 — v1.1:** push notifications (bridge + relay), PTZ, widgets.

---

## 15. Immediate Next Steps

1. On the **Mac**, `create-expo-app` in `app/`, add a **dev build** (EAS) so native modules (VLC) work.
2. Build **M0 spike**: one screen, hardcode this Frigate's Tailscale URL, prove RTSP live + HLS recording both play natively.
3. Wire the **API client** to `/api/config`, `/api/events`, `/vod/...` (URLs verified above).
4. Iterate into the MVP per M1.

---

## Appendix A — M0 Spike (copy-paste starter)

Smallest thing that proves the browser-freeze is gone: one live camera (RTSP, hardware-decoded via libVLC) + one scrubbable recording (HLS via `expo-video`). Runs on a **dev build**, not Expo Go (native modules).

### A.1 Setup (on the Mac)

```bash
npx create-expo-app@latest app && cd app
npx expo install expo-video expo-build-properties
npm install react-native-vlc-media-player
npx expo prebuild            # native modules need a dev build
npx expo run:ios             # or: npx expo run:android
```

### A.2 `app.json` — plugin + allow local cleartext HTTP (Frigate :5000 is http)

```jsonc
"plugins": [
  ["expo-build-properties", { "android": { "usesCleartextTraffic": true } }]
],
"ios": { "infoPlist": { "NSAppTransportSecurity": { "NSAllowsArbitraryLoads": true } } }
```

*(Spike only — see §9 for the production ATS policy.)*

### A.3 `App.tsx` — the whole spike

```tsx
import { useMemo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { VLCPlayer } from 'react-native-vlc-media-player';
import { useVideoPlayer, VideoView } from 'expo-video';

// LAN test: phone on same WiFi. Remote: swap for the Tailscale IP (Tailscale on the phone).
const HOST = '192.168.0.3';
const CAM  = 'camera_1';

export default function App() {
  const recUrl = useMemo(() => {            // last 5 min, ending 30s ago (segments finalized)
    const end = Math.floor(Date.now() / 1000) - 30;
    return `http://${HOST}:5000/vod/${CAM}/start/${end - 300}/end/${end}/master.m3u8`;
  }, []);
  const player = useVideoPlayer(recUrl, p => { p.play(); });

  return (
    <View style={s.c}>
      <Text style={s.h}>LIVE (RTSP · VLC · native)</Text>
      <VLCPlayer style={s.v} source={{ uri: `rtsp://${HOST}:8554/${CAM}` }} />
      <Text style={s.h}>RECORDING (HLS · expo-video · scrub me)</Text>
      <VideoView style={s.v} player={player} allowsFullscreen nativeControls />
    </View>
  );
}
const s = StyleSheet.create({
  c: { flex: 1, backgroundColor: '#000', paddingTop: 60 },
  h: { color: '#8ab', margin: 8, fontWeight: '600' },
  v: { width: '100%', aspectRatio: 16 / 9, backgroundColor: '#111' },
});
```

**Success =** live plays smoothly + you can drag the recording scrubber back/forth with no freeze. Premise proven; the rest is UI. If RTSP is fussy, fall back to go2rtc WebRTC for *live* — recordings (the real pain) are the easy part.

---

## Appendix B — `api.ts` (typed Frigate client, endpoints verified on 0.17)

```ts
// Minimal typed client for Frigate's HTTP API + stream URL builders.
export type FrigateServer = { host: string; apiPort?: number; rtspPort?: number; scheme?: 'http' | 'https' };

export type CameraConfig = { name: string; enabled?: boolean; detect?: { width: number; height: number } };
export type FrigateConfig = { cameras: Record<string, CameraConfig> };

export type FrigateEvent = {
  id: string; camera: string; label: string; sub_label?: string | null;
  start_time: number; end_time: number | null; zones: string[];
  has_clip: boolean; has_snapshot: boolean; thumbnail?: string;
};

export function createClient(s: FrigateServer) {
  const scheme = s.scheme ?? 'http';
  const api = `${scheme}://${s.host}:${s.apiPort ?? 5000}`;
  const rtspHost = `${s.host}:${s.rtspPort ?? 8554}`;

  const j = async <T>(path: string): Promise<T> => {
    const r = await fetch(`${api}${path}`);
    if (!r.ok) throw new Error(`Frigate ${path} → ${r.status}`);
    return r.json() as Promise<T>;
  };

  return {
    getConfig: () => j<FrigateConfig>('/api/config'),
    listCameras: async () => Object.keys((await j<FrigateConfig>('/api/config')).cameras),

    getEvents: (p: { camera?: string; label?: string; before?: number; after?: number; limit?: number } = {}) => {
      const q = new URLSearchParams();
      Object.entries(p).forEach(([k, v]) => v != null && q.append(k, String(v)));
      return j<FrigateEvent[]>(`/api/events?${q.toString()}`);
    },

    // --- stream URLs (hand these to the native players) ---
    liveRtspUrl: (camera: string, sub = false) => `rtsp://${rtspHost}/${camera}${sub ? '_sub' : ''}`,
    // Recordings for a time window as native-scrubbable HLS:
    recordingHlsUrl: (camera: string, startEpoch: number, endEpoch: number) =>
      `${api}/vod/${camera}/start/${Math.floor(startEpoch)}/end/${Math.floor(endEpoch)}/master.m3u8`,
    // On-the-fly single MP4 clip (export/share):
    clipUrl: (camera: string, startEpoch: number, endEpoch: number) =>
      `${api}/api/${camera}/start/${Math.floor(startEpoch)}/end/${Math.floor(endEpoch)}/clip.mp4`,
    eventClipUrl: (id: string) => `${api}/api/events/${id}/clip.mp4`,
    eventThumbUrl: (id: string) => `${api}/api/events/${id}/thumbnail.jpg`,
    snapshotUrl: (camera: string) => `${api}/api/${camera}/latest.jpg`,
  };
}
```
