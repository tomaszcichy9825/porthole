import { useEvent, useEventListener } from 'expo';
import { useVideoPlayer, VideoView, type VideoPlayer } from 'expo-video';
import { Image } from 'expo-image';
import { router, useLocalSearchParams } from 'expo-router';
import { forwardRef, useCallback, useEffect, useImperativeHandle, useMemo, useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Svg, { Path } from 'react-native-svg';

import { LivePlayer } from '@/components/LivePlayer';
import { ScrubPreview, type ScrubPreviewHandle } from '@/components/ScrubPreview';
import { Timeline } from '@/components/Timeline';
import { Mono } from '@/components/ui';
import { useWide } from '@/lib/layout';
import { useCameras, useFrigate, usePreviews, useRecordingSegments } from '@/lib/queries';
import { useActiveServer, useServers } from '@/stores/servers';
import { colors, fonts, radius } from '@/theme';

const RATES = ['1×', '2×', '4×', '8×'] as const;

const titleOf = (n: string) => n.replace(/_/g, ' ').replace(/^./, (c) => c.toUpperCase());

type StageClockHandle = { scrub: (epoch: number | null) => void };

// Wall clock while live, recorded time while playing back, dragged time while
// scrubbing. Scrub positions arrive several times a second, so they come in
// by ref and re-render only this Text, never the console.
const StageClock = forwardRef<StageClockHandle, { playhead: number | null; style: object }>(
  function StageClock({ playhead, style }, ref) {
    const [wall, setWall] = useState(() => Date.now() / 1000);
    const [scrub, setScrub] = useState<number | null>(null);

    useImperativeHandle(ref, () => ({ scrub: setScrub }), []);

    useEffect(() => {
      if (playhead !== null) return;
      const t = setInterval(() => setWall(Date.now() / 1000), 1000);
      return () => clearInterval(t);
    }, [playhead]);

    const at = scrub ?? playhead ?? wall;
    return <Text style={style}>{new Date(at * 1000).toLocaleTimeString(undefined, { hour12: false })}</Text>;
  },
);

// One HLS manifest covers at most an hour: nginx's vod module is slow to
// build long playlists and 503s on windows that start before any media.
const VOD_CHUNK = 3600;
type Chunk = { start: number; end: number };
const chunkFrom = (start: number, now: number): Chunk => ({ start, end: Math.min(start + VOD_CHUNK, now - 30) });
// expo-video's documented API is assignment on the player instance.
const seekPlayer = (p: VideoPlayer, seconds: number) => {
  p.currentTime = seconds;
};

// Design screen 1c: one Cameras console, now/then toggle, always-there
// timeline. Dragging back moves you into the past; NOW returns to live.
export default function CameraConsole() {
  const { name, at } = useLocalSearchParams<{ name: string; at?: string }>();
  const fg = useFrigate();
  const wide = useWide();
  const { reach } = useActiveServer();
  const fullscreenQuality = useServers((s) => s.fullscreenQuality);
  const setQuality = useServers((s) => s.setQuality);
  const muted = useServers((s) => s.muted);
  const setMuted = useServers((s) => s.setMuted);
  const showClock = useServers((s) => s.showClock);
  const { cameras } = useCameras();

  // null = live; an epoch = "then" playback at that moment. The playhead
  // follows playback; the chunk is the loaded HLS manifest and is fixed when
  // set - seeks inside it are native player seeks, not manifest rebuilds.
  // (Deriving the chunk end from the ticking clock rebuilt the player every
  // 30 s, which is why playback kept restarting.)
  const startAt = at ? Number(at) : null;
  const [playhead, setPlayhead] = useState<number | null>(startAt);
  const [chunk, setChunk] = useState<Chunk | null>(() =>
    startAt !== null ? chunkFrom(startAt, Math.floor(Date.now() / 1000)) : null,
  );
  const [rate, setRate] = useState<(typeof RATES)[number]>('1×');

  const [now, setNow] = useState(() => Math.floor(Date.now() / 1000));
  useEffect(() => {
    const t = setInterval(() => setNow(Math.floor(Date.now() / 1000)), 30_000);
    return () => clearInterval(t);
  }, []);
  const live = playhead === null;

  // The stretch of time the timeline has loaded; segments and previews for
  // seeking come from the same queries it uses.
  const [range, setRange] = useState(() => ({ start: now - 3600, end: now }));
  const onRangeChange = useCallback((start: number, end: number) => setRange({ start, end }), []);
  const { data: segments } = useRecordingSegments(name, range.start, range.end);
  const { data: previews } = usePreviews(name, range.start, range.end);

  // Real size of the stream on the stage, as VLC reports it (Frigate's
  // config only knows the detect resolution).
  const [streamSize, setStreamSize] = useState<{ url: string; w: number; h: number } | null>(null);
  const onVideoSize = useCallback((url: string, w: number, h: number) => setStreamSize({ url, w, h }), []);

  // Snap a seek into the recorded segments of the loaded stretch. Outside
  // it we know nothing, so the time is taken as-is.
  const snapToRecording = (t: number): number | null => {
    if (!segments?.length || t < range.start) return t;
    for (const seg of segments) {
      if (t >= seg.start_time && t <= seg.end_time) return t;
      if (seg.start_time > t) return seg.start_time;
    }
    return null; // after the last segment: nothing recorded there yet
  };

  const vodSource = useMemo(() => {
    if (!fg || !name || !chunk || chunk.end <= chunk.start) return null;
    return { uri: fg.recordingHlsUrl(name, chunk.start, chunk.end), headers: fg.authHeaders };
  }, [fg, name, chunk]);

  // expo-video makes a fresh player whenever the source changes, so the
  // setup runs once per chunk. timeUpdate is off by default (interval 0).
  const player = useVideoPlayer(vodSource, (p) => {
    p.timeUpdateEventInterval = 1;
    p.play();
  });
  const { status } = useEvent(player, 'statusChange', { status: player.status });
  const { isPlaying } = useEvent(player, 'playingChange', { isPlaying: player.playing });

  // Scrub preview: dragging the timeline moves a preview clip, never the VOD
  // player, so the drag runs at finger speed and the manifest is rebuilt once
  // on release. Positions go in through a ref, so a drag re-renders nothing
  // here - only the boolean that uncovers the preview does.
  const [scrubbing, setScrubbing] = useState(false);
  const preview = useRef<ScrubPreviewHandle>(null);
  const clock = useRef<StageClockHandle>(null);

  const onScrub = useCallback(
    (t: number | null) => {
      clock.current?.scrub(t);
      if (t === null) {
        setScrubbing(false);
        return;
      }
      setScrubbing(true);
      preview.current?.seek(Math.min(t, now - 60));
    },
    [now],
  );

  useEffect(() => {
    // expo-video's documented API is assignment on the player instance.
    // eslint-disable-next-line react-hooks/immutability
    player.playbackRate = Number(rate.replace('×', ''));
  }, [rate, player]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/immutability
    player.muted = muted;
  }, [muted, player]);

  // Playback moves the playhead (timeline marker and clock) once a second.
  useEventListener(player, 'timeUpdate', ({ currentTime }) => {
    if (!chunk || scrubbing) return;
    const t = Math.floor(chunk.start + currentTime);
    setPlayhead((p) => (p !== null && Math.floor(p) === t ? p : t));
  });

  const goLive = () => {
    setPlayhead(null);
    setChunk(null);
  };

  const seekTo = (t: number) => {
    if (t >= now - 15) {
      goLive(); // scrolled up to the present
      return;
    }
    const snapped = snapToRecording(Math.min(t, now - 60));
    if (snapped === null) {
      goLive(); // nothing recorded there
      return;
    }
    const target = Math.min(snapped, now - 60);
    setPlayhead(target);
    preview.current?.seek(target); // hold the preview over the stage while the VOD loads
    if (chunk && target >= chunk.start && target < chunk.end - 5) {
      seekPlayer(player, target - chunk.start);
    } else {
      setChunk(chunkFrom(target, now));
    }
  };

  // An hour's manifest ran out: continue into the next one, or catch up to
  // live if we have reached it.
  useEventListener(player, 'playToEnd', () => {
    if (!chunk) return;
    if (chunk.end >= now - 90) goLive();
    else seekTo(chunk.end);
  });

  const seekBy = (seconds: number) => {
    if (playhead === null) {
      // Rewinding from live drops into then-mode.
      if (seconds < 0) seekTo(now + seconds);
      return;
    }
    seekTo(playhead + seconds);
  };

  if (!fg || !name) return null;

  // Cover the stage while dragging, and afterwards until the new manifest is
  // ready - otherwise the video goes black for the length of the VOD load.
  const showPreview = scrubbing || (!live && status !== 'readyToPlay');
  const vodFailed = !live && status === 'error';

  const liveUrl = fg.liveRtspUrl(name, fullscreenQuality === 'sub');
  const resText = streamSize?.url === liveUrl ? `${streamSize.w}×${streamSize.h}` : '';

  return (
    <SafeAreaView style={s.safe} edges={['top']}>
      {/* top bar */}
      <View style={s.topBar}>
        <Pressable onPress={() => router.back()} style={s.back}>
          <Svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke={colors.textLabel} strokeWidth={2.2}>
            <Path d="M15 6l-6 6 6 6" />
          </Svg>
          {wide ? <Text style={s.backText}>All cameras</Text> : null}
        </Pressable>
        <View style={s.vDivider} />
        <Text style={s.title} numberOfLines={1}>
          {titleOf(name)}
        </Text>

        <View style={s.modeToggle}>
          <Pressable onPress={goLive} style={[s.modeItem, live && s.modeItemActive]}>
            {live ? <View style={s.liveDot} /> : null}
            <Text style={[s.modeText, live && s.modeTextActive]}>Now</Text>
          </Pressable>
          <Pressable onPress={() => seekTo(now - 300)} style={[s.modeItem, !live && s.modeItemActive]}>
            <Text style={[s.modeText, !live && s.modeTextActive]}>Then</Text>
          </Pressable>
        </View>
        {wide ? <Text style={s.hint}>or scroll the timeline</Text> : null}
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
        {/* Desktop: the stage takes whatever height the controls leave and
            letterboxes the video inside; phones keep a 16:9 box. */}
        <View style={[s.stage, wide ? s.stageWide : s.stageNarrow]}>
          {live ? (
            <LivePlayer
              rtspUrl={liveUrl}
              snapshotUrl={fg.snapshotUrl(name)}
              headers={fg.authHeaders}
              style={s.video}
              muted={muted}
              onVideoSize={onVideoSize}
            />
          ) : (
            <VideoView player={player} style={s.video} nativeControls={false} contentFit="contain" />
          )}
          {/* Stays mounted so its clip is already open when a drag starts;
              only its opacity changes, which costs nothing mid-drag. */}
          <View style={[StyleSheet.absoluteFill, !showPreview && s.hidden]} pointerEvents="none">
            <ScrubPreview ref={preview} fg={fg} camera={name} clips={previews ?? []} />
          </View>
          <View style={s.stageOverlay} pointerEvents="none">
            <View style={s.stageTopRow}>
              {live ? (
                <View style={s.stageBadgeDark}>
                  <Mono style={s.stageBadgeText}>{resText ? `${resText} · ${fullscreenQuality}` : fullscreenQuality}</Mono>
                </View>
              ) : (
                <View />
              )}
              {live ? (
                <View style={s.liveBadge}>
                  <Text style={s.liveBadgeText}>LIVE</Text>
                </View>
              ) : (
                <View style={[s.stageBadgeDark, vodFailed && s.stageBadgeErr]}>
                  <Mono style={s.stageBadgeText}>{vodFailed ? 'no recording here' : `${rate} playback`}</Mono>
                </View>
              )}
            </View>
            <View style={s.stageBottomRow}>
              {showClock ? <StageClock ref={clock} playhead={playhead} style={s.clock} /> : null}
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
                  // `now` ticks every 30 s: refreshes the strip and retries a failed load.
                  source={{ uri: `${fg.snapshotUrl(c, 180)}&t=${now}`, headers: fg.authHeaders }}
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
            <Pressable style={wide ? s.tBtn : s.tBtnSquare} onPress={() => seekBy(-30)}>
              {wide ? <Text style={s.tBtnText}>Rewind 30 s</Text> : <Mono style={s.tBtnMono}>−30</Mono>}
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
                if (isPlaying) player.pause();
                else player.play();
              }}
            >
              {!live && isPlaying ? (
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
            <View style={s.tDivider} />
            <Pressable
              style={s.tBtnSquare}
              onPress={() => setMuted(!muted)}
              accessibilityLabel={muted ? 'Unmute' : 'Mute'}
            >
              <Svg
                width={17}
                height={17}
                viewBox="0 0 24 24"
                fill="none"
                stroke={muted ? colors.textMuted : colors.accent}
                strokeWidth={2}
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <Path d="M4 9v6h4l5 4V5L8 9H4z" />
                {muted ? (
                  <>
                    <Path d="M17 9.5l5 5" />
                    <Path d="M22 9.5l-5 5" />
                  </>
                ) : (
                  <>
                    <Path d="M16.5 8.8a4.5 4.5 0 0 1 0 6.4" />
                    <Path d="M19.2 6.2a8 8 0 0 1 0 11.6" />
                  </>
                )}
              </Svg>
            </Pressable>
          </View>

          <View style={s.tGroup}>
            {RATES.map((r) => (
              <Pressable
                key={r}
                onPress={() => setRate(r)}
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
        </View>

        {/* timeline panel */}
        <View style={s.timelinePanel}>
          <Timeline
            camera={name}
            now={now}
            playhead={playhead}
            onSeek={seekTo}
            onScrub={onScrub}
            onRangeChange={onRangeChange}
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
  title: { fontSize: 16, fontFamily: fonts.sansSemiBold, color: colors.ink, letterSpacing: -0.2, flexShrink: 1 },
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
    alignSelf: 'center',
    width: '100%',
  },
  stageNarrow: { aspectRatio: 16 / 9, maxHeight: '55%' },
  stageWide: { flex: 1 },
  video: { flex: 1 },
  hidden: { opacity: 0 },
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
  stageBadgeErr: { backgroundColor: 'rgba(180,69,31,0.85)' },
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
