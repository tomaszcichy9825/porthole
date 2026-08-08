# Design → API feasibility

Every feature in the approved design (Claude Design project, screens 1c + 2a–2e) checked against the live Frigate 0.17.2 OpenAPI spec (`/api/openapi.json`, 130 paths, verified 2026-08-07). All endpoint paths below are relative to `/api` unless stated.

## Confirmed straightforward

| Design element | Endpoint(s) |
|---|---|
| Onboarding test connection, camera chips, version | `GET /config`, `GET /version` (both probed live) |
| Live grid tiles, LIVE/SNAP modes | RTSP restream `:8554` + `GET /{camera}/latest.{ext}` polling |
| Camera groups | `camera_groups` in `/config` |
| Timeline recorded segments and gaps | `GET /{camera}/recordings`, `GET /{camera}/recordings/summary` |
| Timeline event markers, activity | `GET /events`, `GET /timeline`, `GET /timeline/hourly`, `GET /review/activity/motion` |
| Then-mode playback, speeds, rewind | `GET /vod/{camera}/start/{ts}/end/{ts}` (HLS VOD; rate/seek are player-side) |
| Scrub thumbnails (spec §13 risk — resolved) | `GET /{camera}/recordings/{frame_time}/snapshot.{format}`, plus `preview.gif` / `preview.mp4` window previews |
| Events list, filters, counts | `GET /events?camera=&label=&zones=&after=&before=&has_clip=`, `GET /events/summary`, `GET /labels`, `GET /sub_labels` |
| Event search | `GET /events/search` (semantic, embeddings) |
| Event detail: score, zones, clip, thumbnail | event object + `GET /events/{id}/clip.mp4`, `/events/{id}/thumbnail.{ext}` |
| "recognised · Tomasz" sub label (faces) | `sub_label` on events; `/faces/*` endpoints live on 0.17 |
| Licence plate ("plate KR 4821") | `recognized_license_plate` on events; `/lpr/reprocess`, `/recognized_license_plates` |
| Delete / download / export event | `DELETE /events/{id}`, `GET /events/{id}/clip.mp4`, `POST /export/{camera}/start/{ts}/end/{ts}` |
| Record button (manual event) | `POST /events/{camera}/{label}/create` |
| Storage line in settings | `GET /recordings/storage`, `GET /stats` |
| Auth (username/password) | `POST /login`, `GET /auth`, `GET /profile` |
| Local/remote reachability, auto-switch, ping ms | app-side (fetch race against both URLs) |

## Feasible with caveats

| Design element | Reality |
|---|---|
| Per-tile stream latency ("120 ms") | Not exposed by the API. Either estimate client-side from player buffer stats or drop the number. |
| PTZ pad + presets | `GET /{camera}/ptz/info` gives capabilities and preset names, but movement commands are not in the HTTP API — the web UI sends them over the `/ws` websocket (MQTT bridge). We implement the same websocket messages; presets list comes from `ptz/info`. |
| Talk back (two-way audio) | go2rtc WebRTC with microphone. Needs `react-native-webrtc`; stays v2+ as per spec §4.3. The toggle in screen 1c ships disabled/hidden until then. |

Nothing in the design is blocked by the API.
