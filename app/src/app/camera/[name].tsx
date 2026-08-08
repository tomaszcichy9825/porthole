import { useVideoPlayer, VideoView } from 'expo-video';
import { router, useLocalSearchParams } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { LivePlayer } from '@/components/LivePlayer';
import { Timeline } from '@/components/Timeline';
import { Mono, Segmented } from '@/components/ui';
import { useEvents, useFrigate, useRecordingSegments } from '@/lib/queries';
import { useServers } from '@/stores/servers';
import { colors, fonts, radius } from '@/theme';

const WINDOWS = { '24 h': 24 * 3600, '12 h': 12 * 3600, '1 h': 3600, '5 m': 300 } as const;
type WindowKey = keyof typeof WINDOWS;
const RATES = ['1×', '2×', '4×', '8×'] as const;

// Design screen 1c: one Cameras console, now/then toggle, always-there
// timeline. Dragging back moves you into the past; NOW returns to live.
export default function CameraConsole() {
  const { name, at } = useLocalSearchParams<{ name: string; at?: string }>();
  const fg = useFrigate();
  const fullscreenQuality = useServers((s) => s.fullscreenQuality);

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
  const windowStart = now - WINDOWS[windowKey];

  const { data: segments } = useRecordingSegments(name, windowStart, now);
  const { data: events } = useEvents({ camera: name, after: windowStart, limit: 100 });

  // VOD window: from the seek point to (near) now; segments need ~30 s to finalise.
  const vodUrl = useMemo(() => {
    if (!fg || !name || playhead === null) return null;
    return fg.recordingHlsUrl(name, playhead, now - 30);
  }, [fg, name, playhead, now]);

  const player = useVideoPlayer(vodUrl, (p) => {
    p.play();
  });

  const setSpeed = (r: (typeof RATES)[number]) => {
    setRate(r);
    // expo-video's documented API is assignment on the player instance.
    // eslint-disable-next-line react-hooks/immutability
    player.playbackRate = Number(r.replace('×', ''));
  };

  const seekBy = (seconds: number) => {
    const t = touchNow();
    if (playhead === null) {
      // Rewinding from live drops into then-mode.
      if (seconds < 0) setPlayhead(t + seconds);
      return;
    }
    setPlayhead(Math.min(playhead + seconds, t - 60));
  };

  if (!fg || !name) return null;

  const live = playhead === null;
  const title = name.replace(/_/g, ' ').replace(/^./, (c) => c.toUpperCase());

  return (
    <SafeAreaView style={s.safe}>
      <View style={s.content}>
      <View style={s.header}>
        <Pressable onPress={() => router.back()} style={s.back}>
          <Text style={s.backText}>‹ All cameras</Text>
        </Pressable>
        <Text style={s.title}>{title}</Text>
        <View style={{ flex: 1 }} />
        <View style={s.modeToggle}>
          <Pressable onPress={() => setPlayhead(null)} style={[s.modeItem, live && s.modeItemActive]}>
            {live ? <View style={s.liveDot} /> : null}
            <Text style={[s.modeText, live && s.modeTextActive]}>Now</Text>
          </Pressable>
          <Pressable
            onPress={() => setPlayhead(touchNow() - 300)}
            style={[s.modeItem, !live && s.modeItemActive]}
          >
            <Text style={[s.modeText, !live && s.modeTextActive]}>Then</Text>
          </Pressable>
        </View>
      </View>

      <View style={s.stage}>
        {live ? (
          <LivePlayer
            rtspUrl={fg.liveRtspUrl(name, fullscreenQuality === 'sub')}
            snapshotUrl={fg.snapshotUrl(name)}
            style={s.video}
          />
        ) : (
          <VideoView player={player} style={s.video} nativeControls={false} contentFit="contain" />
        )}
        <View style={s.stageBadge}>
          {live ? (
            <View style={s.liveBadge}>
              <Text style={s.liveBadgeText}>LIVE</Text>
            </View>
          ) : (
            <Mono style={s.thenTime}>
              {playhead !== null
                ? new Date(playhead * 1000).toLocaleTimeString(undefined, {
                    hour: '2-digit',
                    minute: '2-digit',
                    second: '2-digit',
                  })
                : ''}
            </Mono>
          )}
        </View>
      </View>

      <View style={s.transport}>
        <Pressable style={s.tBtn} onPress={() => seekBy(-30)}>
          <Text style={s.tBtnText}>Rewind 30 s</Text>
        </Pressable>
        <Pressable style={s.tBtn} onPress={() => seekBy(-10)}>
          <Mono style={s.tBtnMono}>−10</Mono>
        </Pressable>
        <Pressable
          style={[s.tBtn, s.tBtnPrimary]}
          onPress={() => {
            if (live) return;
            if (player.playing) player.pause();
            else player.play();
          }}
        >
          <Text style={s.tBtnPrimaryText}>{live ? 'Live' : player.playing ? 'Pause' : 'Play'}</Text>
        </Pressable>
        <Pressable style={s.tBtn} onPress={() => seekBy(10)} disabled={live}>
          <Mono style={[s.tBtnMono, live && s.disabled]}>+10</Mono>
        </Pressable>
        <View style={{ flex: 1 }} />
        {!live ? (
          <Segmented options={RATES} value={rate} onChange={setSpeed} mono />
        ) : null}
      </View>

      <View style={s.timelineWrap}>
        <View style={s.timelineHead}>
          <Text style={s.timelineHint}>
            {live ? 'drag the timeline back to rewind' : 'tap NOW to return to live'}
          </Text>
          <Segmented
            options={Object.keys(WINDOWS) as WindowKey[]}
            value={windowKey}
            onChange={setWindowKey}
          />
        </View>
        <Timeline
          windowStart={windowStart}
          windowEnd={now}
          segments={segments ?? []}
          events={events ?? []}
          playhead={playhead}
          onSeek={(t) => setPlayhead(Math.min(t, touchNow() - 60))}
        />
        <View style={s.legend}>
          {(['Person', 'Car', 'Animal'] as const).map((l) => (
            <View key={l} style={s.legendItem}>
              <View
                style={[
                  s.legendDot,
                  { backgroundColor: l === 'Person' ? colors.person : l === 'Car' ? colors.car : colors.animal },
                ]}
              />
              <Text style={s.legendText}>{l}</Text>
            </View>
          ))}
        </View>
      </View>
      </View>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.paper },
  content: { flex: 1, width: '100%', maxWidth: 1100, alignSelf: 'center' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  back: { paddingVertical: 6, paddingRight: 4 },
  backText: { fontSize: 13, fontFamily: fonts.sansSemiBold, color: colors.textLabel },
  title: { fontSize: 16, fontFamily: fonts.sansSemiBold, color: colors.ink },
  modeToggle: {
    flexDirection: 'row',
    backgroundColor: colors.fill,
    borderRadius: radius.md,
    padding: 4,
    gap: 2,
  },
  modeItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 13,
    paddingVertical: 8,
    borderRadius: 7,
  },
  modeItemActive: { backgroundColor: colors.ink },
  modeText: { fontSize: 13, fontFamily: fonts.sansMedium, color: colors.textMuted },
  modeTextActive: { color: '#fff', fontFamily: fonts.sansSemiBold },
  liveDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: colors.live },
  stage: { marginHorizontal: 16, borderRadius: 12, overflow: 'hidden', aspectRatio: 16 / 9 },
  video: { flex: 1 },
  stageBadge: { position: 'absolute', top: 12, right: 12 },
  liveBadge: {
    backgroundColor: colors.live,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  liveBadgeText: { color: colors.liveInk, fontSize: 12, fontFamily: fonts.sansBold, letterSpacing: 0.6 },
  thenTime: {
    fontSize: 13,
    color: '#fff',
    backgroundColor: colors.overlay,
    borderRadius: 7,
    paddingHorizontal: 10,
    paddingVertical: 6,
    overflow: 'hidden',
  },
  transport: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  tBtn: {
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
    borderRadius: radius.md,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  tBtnText: { fontSize: 12.5, fontFamily: fonts.sansSemiBold, color: colors.textLabel },
  tBtnMono: { fontSize: 11, fontFamily: fonts.monoSemiBold, color: colors.textLabel },
  tBtnPrimary: { backgroundColor: colors.accent, borderColor: colors.accent },
  tBtnPrimaryText: { fontSize: 12.5, fontFamily: fonts.sansSemiBold, color: '#fff' },
  disabled: { color: '#C3CCD0' },
  timelineWrap: { paddingHorizontal: 16, gap: 10, marginTop: 4 },
  timelineHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  timelineHint: { fontSize: 12, color: colors.textFaint, fontFamily: fonts.sans },
  legend: { flexDirection: 'row', gap: 14 },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  legendDot: { width: 9, height: 9, borderRadius: 2 },
  legendText: { fontSize: 12, color: colors.textMuted, fontFamily: fonts.sans },
});
