# Porthole

**A fast, native, cross-platform client for [Frigate NVR](https://frigate.video).**

> The native Frigate app that doesn't freeze. Live view and instant-rewind recordings, hardware-decoded, no cloud.

**Status: pre-alpha.** Nothing to install yet. Watch/star the repo if you're interested.

## Why

Frigate's only first-party client is a browser web UI. Browsers decode video through MSE/WebCodecs, which chokes on high-resolution H.264/H.265 footage: playback stutters, fast-forward throws decode errors, and reviewing recordings freezes the tab. This is a client decode problem, not a server, disk or network problem.

Porthole delegates all decoding to the platform's hardware decoder (ExoPlayer on Android, AVPlayer on iOS, libVLC for RTSP). The app never touches raw frames.

## Planned features (v1)

- Add one or more Frigate servers by URL; works over LAN, Tailscale, WireGuard or any reachable URL
- Live view via RTSP restream, hardware-decoded, main/sub stream toggle
- Recordings player with a scrubbable timeline (HLS VOD): seek, rewind, fast-forward, jump-to-time
- Events list with thumbnails, filterable by camera, label and time
- H.265 support
- Local-first and private: video never leaves your network, no account, no telemetry

## Tech

Expo (React Native) + TypeScript. Native video via `expo-video` (recordings, HLS) and libVLC (live RTSP). See [docs/spec.md](docs/spec.md) for the full product specification.

## Development

```sh
make help
```

## Support

Porthole is free and open source, with no paywalls and no feature gating. If you find it useful, you can [sponsor development](https://github.com/sponsors/tomaszcichy9825).

## Licence

[MPL-2.0](LICENSE).

Porthole is an independent third-party client and is not affiliated with or endorsed by the Frigate project. Frigate is a trademark of its respective owners.
