import { useVideoPlayer, VideoView } from 'expo-video';
import { Image } from 'expo-image';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Svg, { Path } from 'react-native-svg';

import { LivePlayer } from '@/components/LivePlayer';
import { Timeline } from '@/components/Timeline';
import { Mono } from '@/components/ui';
import { useWide } from '@/lib/layout';
import { useCameras, useEvents, useFrigate, useRecordingSegments } from '@/lib/queries';
import { useActiveServer, useServers } from '@/stores/servers';
import { colors, fonts, radius } from '@/theme';

const WINDOWS = { '24 h': 24 * 3600, '12 h': 12 * 3600, '1 h': 3600, '5 m': 300 } as const;
type WindowKey = keyof typeof WINDOWS;
const RATES = ['1×', '2×', '4×', '8×'] as const;

const titleOf = (n: string) => n.replace(/_/g, ' ').replace(/^./, (c) => c.toUpperCase());

// Design screen 1c: one Cameras console, now/then toggle, always-there
// timeline. Dragging back moves you into the past; NOW returns to live.
export default function CameraConsole() {
  const { name, at } = useLocalSearchParams<{ name: string; at?: string }>();
  const fg = useFrigate();
  const wide = useWide();
  const { reach } = useActiveServer();
  const fullscreenQuality = useServers((s) => s.fullscreenQuality);
  const setQuality = useServers((s) => s.setQuality);
  const { cameras, data: config } = useCameras();

  // null = live; an epoch = "then" playback starting there.
  const [playhead, setPlayhead] = useState<number | null>(at ? Number(at) : null);
  const [windowKey, setWindowKey] = useState<WindowKey>('12 h');
  const [rate, setRate] = useState<(typeof RATES)[number]>('1×');

  const [now, setNow] = useState(() => Math.floor(Date.now() / 1000));
  const touchNow = () => {
    const t = Math.floor(Date.now() / 1000);
    setNow(t);
    return t;
  };
  const live = playhead === null;

  // The big clock ticks every second while live.
  const [clock, setClock] = useState(() => Date.now());
  useEffect(() => {
    if (!live) return;
    const t = setInterval(() => setClock(Date.now()), 1000);
    return () => clearInterval(t);
  }, [live]);

  const windowStart = now - WINDOWS[windowKey];
  const { data: segments } = useRecordingSegments(name, windowStart, now);
  const { data: events } = useEvents({ camera: name, after: windowStart, limit: 100 });

  // A VOD playlist whose window starts before any recorded media 503s in
  // nginx's vod module, and an hours-long manifest is slow to build. Snap
  // the seek into the recorded segments and serve at most an hour per chunk.
  const snapToRecording = (t: number): number | null => {
    if (!segments?.length) return t;
    for (const seg of segments) {
      if (t >= seg.start_time && t <= seg.end_time) return t;
      if (seg.start_time > t) return seg.start_time;
    }
    return null; // after the last segment: nothing recorded there yet
  };

  const VOD_CHUNK = 3600;
  const vodSource = useMemo(() => {
    if (!fg || !name || playhead === null) return null;
    const end = Math.min(playhead + VOD_CHUNK, now - 30);
    if (end <= playhead) return null;
    return { uri: fg.recordingHlsUrl(name, playhead, end), headers: fg.authHeaders };
  }, [fg, name, playhead, now]);

  const player = useVideoPlayer(vodSource, (p) => {
    p.play();
  });

  const setSpeed = (r: (typeof RATES)[number]) => {
    setRate(r);
    // expo-video's documented API is assignment on the player instance.
    // eslint-disable-next-line react-hooks/immutability
    player.playbackRate = Number(r.replace('×', ''));
  };

  const seekTo = (t: number) => {
    const nowT = touchNow();
    const snapped = snapToRecording(Math.min(t, nowT - 60));
    if (snapped === null) {
      setPlayhead(null); // nothing recorded there: stay/return to live
      return;
    }
    setPlayhead(Math.min(snapped, nowT - 60));
  };

  const seekBy = (seconds: number) => {
    const t = touchNow();
    if (playhead === null) {
      // Rewinding from live drops into then-mode.
      if (seconds < 0) seekTo(t + seconds);
      return;
    }
    seekTo(playhead + seconds);
  };

  if (!fg || !name) return null;

  const detect = config?.cameras[name]?.detect;
  const resText = detect ? `${detect.width}×${detect.height}` : '';
  const clockText = live
    ? new Date(clock).toLocaleTimeString(undefined, { hour12: false })
    : new Date(playhead * 1000).toLocaleTimeString(undefined, { hour12: false });

  return (
    <SafeAreaView style={s.safe} edges={wide ? [] : ['top']}>
      {/* top bar */}
      <View style={s.topBar}>
        <Pressable onPress={() => router.back()} style={s.back}>
          <Svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke={colors.textLabel} strokeWidth={2.2}>
            <Path d="M15 6l-6 6 6 6" />
          </Svg>
          <Text style={s.backText}>All cameras</Text>
        </Pressable>
        <View style={s.vDivider} />
        <Text style={s.title}>{titleOf(name)}</Text>

        <View style={s.modeToggle}>
          <Pressable onPress={() => setPlayhead(null)} style={[s.modeItem, live && s.modeItemActive]}>
            {live ? <View style={s.liveDot} /> : null}
            <Text style={[s.modeText, live && s.modeTextActive]}>Now</Text>
          </Pressable>
          <Pressable onPress={() => seekTo(touchNow() - 300)} style={[s.modeItem, !live && s.modeItemActive]}>
            <Text style={[s.modeText, !live && s.modeTextActive]}>Then</Text>
          </Pressable>
        </View>
        {wide ? <Text style={s.hint}>or just tap the timeline</Text> : null}
        <View style={{ flex: 1 }} />

        <View style={s.qualityToggle}>
          {(['main', 'sub'] as const).map((q) => (
            <Pressable
              key={q}
              onPress={() => setQuality('fullscreen', q)}
              style={[s.qualityItem, fullscreenQuality === q && s.qualityItemActive]}
            >
              <Text style={[s.qualityText, fullscreenQuality === q && s.qualityTextActive]}>{q}</Text>
            </Pressable>
          ))}
        </View>
        {wide && reach ? (
          <View style={s.connPill}>
            <Svg width={13} height={13} viewBox="0 0 24 24" fill="none" stroke={colors.accent} strokeWidth={2}>
              <Path d="M5 12.5 9.5 17 19 7.5" />
            </Svg>
            <Mono style={s.connText}>
              {reach.kind} · {reach.ms} ms
            </Mono>
          </View>
        ) : null}
      </View>

      <View style={s.body}>
        {/* stage */}
        <View style={s.stage}>
          {live ? (
            <LivePlayer
              rtspUrl={fg.liveRtspUrl(name, fullscreenQuality === 'sub')}
              snapshotUrl={fg.snapshotUrl(name)}
              headers={fg.authHeaders}
              style={s.video}
            />
          ) : (
            <VideoView player={player} style={s.video} nativeControls={false} contentFit="contain" />
          )}
          <View style={s.stageOverlay} pointerEvents="none">
            <View style={s.stageTopRow}>
              {resText ? (
                <View style={s.stageBadgeDark}>
                  <Mono style={s.stageBadgeText}>
                    {resText} · {fullscreenQuality}
                  </Mono>
                </View>
              ) : (
                <View />
              )}
              {live ? (
                <View style={s.liveBadge}>
                  <Text style={s.liveBadgeText}>LIVE</Text>
                </View>
              ) : (
                <View style={s.stageBadgeDark}>
                  <Mono style={s.stageBadgeText}>{rate} playback</Mono>
                </View>
              )}
            </View>
            <View style={s.stageBottomRow}>
              <Text style={s.clock}>{clockText}</Text>
            </View>
          </View>
        </View>

        {/* camera strip */}
        {cameras.length > 1 ? (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={s.strip} contentContainerStyle={s.stripInner}>
            {cameras.map((c) => (
              <Pressable
                key={c}
                onPress={() => router.setParams({ name: c })}
                style={[s.thumb, c === name && s.thumbActive]}
              >
                <Image
                  source={{ uri: fg.snapshotUrl(c, 180), headers: fg.authHeaders }}
                  style={StyleSheet.absoluteFill}
                  contentFit="cover"
                />
                <View style={s.thumbLabel}>
                  <Text style={s.thumbLabelText} numberOfLines={1}>
                    {titleOf(c)}
                  </Text>
                </View>
              </Pressable>
            ))}
          </ScrollView>
        ) : null}

        {/* transport */}
        <View style={s.transport}>
          <View style={s.tGroup}>
            <Pressable style={s.tBtn} onPress={() => seekBy(-30)}>
              <Text style={s.tBtnText}>Rewind 30 s</Text>
            </Pressable>
            <View style={s.tDivider} />
            <Pressable style={s.tBtnSquare} onPress={() => seekBy(-10)}>
              <Mono style={s.tBtnMono}>−10</Mono>
            </Pressable>
            <Pressable
              style={s.tPlay}
              onPress={() => {
                if (live) {
                  seekBy(-30);
                  return;
                }
                if (player.playing) player.pause();
                else player.play();
              }}
            >
              {!live && player.playing ? (
                <Svg width={15} height={15} viewBox="0 0 24 24" fill="#fff">
                  <Path d="M7 4h4v16H7zM13 4h4v16h-4z" />
                </Svg>
              ) : (
                <Svg width={15} height={15} viewBox="0 0 24 24" fill="#fff">
                  <Path d="M8 5l12 7-12 7z" />
                </Svg>
              )}
            </Pressable>
            <Pressable style={s.tBtnSquare} onPress={() => seekBy(10)} disabled={live}>
              <Mono style={[s.tBtnMono, live && s.disabled]}>+10</Mono>
            </Pressable>
          </View>

          <View style={s.tGroup}>
            {RATES.map((r) => (
              <Pressable
                key={r}
                onPress={() => setSpeed(r)}
                disabled={live}
                style={[s.rateItem, !live && r === rate && s.rateItemActive]}
              >
                <Mono style={[s.rateText, live && s.disabled, !live && r === rate && s.rateTextActive]}>{r}</Mono>
              </Pressable>
            ))}
          </View>

          <View style={{ flex: 1 }} />

          {wide ? (
            <View style={s.legend}>
              {(
                [
                  ['Person', colors.person],
                  ['Car', colors.car],
                  ['Animal', colors.animal],
                ] as const
              ).map(([l, c]) => (
                <View key={l} style={s.legendItem}>
                  <View style={[s.legendDot, { backgroundColor: c }]} />
                  <Text style={s.legendText}>{l}</Text>
                </View>
              ))}
            </View>
          ) : null}

          <View style={s.tGroup}>
            {(Object.keys(WINDOWS) as WindowKey[]).map((w) => (
              <Pressable key={w} onPress={() => setWindowKey(w)} style={[s.winItem, w === windowKey && s.winItemActive]}>
                <Text style={[s.winText, w === windowKey && s.winTextActive]}>{w}</Text>
              </Pressable>
            ))}
          </View>
        </View>

        {/* timeline panel */}
        <View style={s.timelinePanel}>
          <Timeline
            windowStart={windowStart}
            windowEnd={now}
            segments={segments ?? []}
            events={events ?? []}
            playhead={playhead}
            onSeek={seekTo}
          />
        </View>
      </View>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.paper },
  topBar: {
    height: 56,
    backgroundColor: colors.card,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    gap: 12,
  },
  back: { flexDirection: 'row', alignItems: 'center', gap: 7, paddingVertical: 8 },
  backText: { fontSize: 13, fontFamily: fonts.sansSemiBold, color: colors.textLabel },
  vDivider: { width: 1, height: 20, backgroundColor: colors.border },
  title: { fontSize: 16, fontFamily: fonts.sansSemiBold, color: colors.ink, letterSpacing: -0.2 },
  modeToggle: {
    flexDirection: 'row',
    backgroundColor: colors.fill,
    borderRadius: 10,
    padding: 4,
    gap: 2,
  },
  modeItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 7,
  },
  modeItemActive: { backgroundColor: colors.ink },
  modeText: { fontSize: 13, fontFamily: fonts.sansMedium, color: colors.textMuted },
  modeTextActive: { color: '#fff', fontFamily: fonts.sansSemiBold },
  liveDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: colors.live },
  hint: { fontSize: 12.5, color: colors.textFaint, fontFamily: fonts.sans },
  qualityToggle: {
    flexDirection: 'row',
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: 4,
    gap: 2,
  },
  qualityItem: { paddingHorizontal: 11, paddingVertical: 7, borderRadius: 6 },
  qualityItemActive: { backgroundColor: colors.accentSoft },
  qualityText: { fontFamily: fonts.monoSemiBold, fontSize: 12, color: colors.textMuted },
  qualityTextActive: { color: colors.accent },
  connPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    backgroundColor: colors.fill,
    borderRadius: 8,
    paddingHorizontal: 11,
    paddingVertical: 7,
  },
  connText: { fontSize: 12, color: colors.textMuted },

  body: { flex: 1, padding: 16, gap: 12 },
  stage: {
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: colors.tile,
    aspectRatio: 16 / 9,
    maxHeight: '55%',
    alignSelf: 'center',
    width: '100%',
  },
  video: { flex: 1 },
  stageOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'space-between',
    padding: 14,
  },
  stageTopRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  stageBadgeDark: {
    backgroundColor: colors.overlay,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 7,
  },
  stageBadgeText: { fontSize: 12, color: colors.videoText },
  liveBadge: { backgroundColor: colors.live, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 7 },
  liveBadgeText: { color: colors.liveInk, fontSize: 12, fontFamily: fonts.sansBold, letterSpacing: 0.6 },
  stageBottomRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end' },
  clock: {
    fontFamily: fonts.monoMedium,
    color: '#fff',
    fontSize: 34,
    letterSpacing: -0.7,
    textShadowColor: 'rgba(0,0,0,0.6)',
    textShadowRadius: 12,
    textShadowOffset: { width: 0, height: 2 },
  },

  strip: { flexGrow: 0 },
  stripInner: { gap: 10 },
  thumb: {
    width: 148,
    height: 84,
    borderRadius: 10,
    overflow: 'hidden',
    backgroundColor: colors.tile,
  },
  thumbActive: { borderWidth: 2, borderColor: colors.accent },
  thumbLabel: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: 8,
    paddingVertical: 6,
    backgroundColor: 'rgba(0,0,0,0.55)',
  },
  thumbLabelText: { color: '#fff', fontSize: 11, fontFamily: fonts.sansSemiBold },

  transport: { flexDirection: 'row', alignItems: 'center', gap: 10, flexWrap: 'wrap' },
  tGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    padding: 5,
    gap: 2,
  },
  tBtn: { height: 38, paddingHorizontal: 12, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  tBtnText: { fontSize: 12.5, fontFamily: fonts.sansSemiBold, color: colors.textLabel },
  tBtnSquare: { width: 38, height: 38, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  tBtnMono: { fontSize: 11, color: colors.textLabel, fontFamily: fonts.monoSemiBold },
  tPlay: {
    width: 44,
    height: 38,
    borderRadius: 8,
    backgroundColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tDivider: { width: 1, height: 22, backgroundColor: colors.border, marginHorizontal: 3 },
  rateItem: { paddingHorizontal: 12, paddingVertical: 9, borderRadius: 8 },
  rateItemActive: { backgroundColor: colors.ink },
  rateText: { fontSize: 12, color: '#C3CCD0', fontFamily: fonts.monoSemiBold },
  rateTextActive: { color: '#fff' },
  disabled: { color: '#C3CCD0' },
  winItem: { paddingHorizontal: 11, paddingVertical: 9, borderRadius: 8 },
  winItemActive: { backgroundColor: colors.accentSoft },
  winText: { fontSize: 12, fontFamily: fonts.sansSemiBold, color: colors.textMuted },
  winTextActive: { color: colors.accent },

  legend: { flexDirection: 'row', gap: 14, paddingHorizontal: 4 },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  legendDot: { width: 9, height: 9, borderRadius: 2 },
  legendText: { fontSize: 12, color: colors.textMuted, fontFamily: fonts.sans },

  timelinePanel: {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.xl,
    padding: 14,
  },
});
