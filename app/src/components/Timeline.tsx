import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  type NativeScrollEvent,
  type NativeSyntheticEvent,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import type { RecordingSegment } from '@/lib/frigate';
import { useEvents, useMotion, useRecordingSegments } from '@/lib/queries';
import { colors, fonts, labelColor } from '@/theme';

// A scrolling strip of time, like the Frigate UI: the playhead sits in the
// middle and the strip moves under it. Dragging scrubs (preview follows),
// letting go seeks, a tap seeks to the tapped moment, and playback keeps
// the strip moving so the playhead never leaves the centre.
//
// ponytail: seven days of strip, fixed. Read /recordings/summary for the
// real retention if someone keeps months.
const EXTENT = 7 * 86400;
// Seconds visible across the lane at each zoom step.
const ZOOMS = [300, 900, 3600, 3 * 3600, 6 * 3600, 12 * 3600, 86400];
const MAX_EVENT_TICKS = 200;
const SCRUB_EMIT_MS = 120;

const hhmmss = (epoch: number) => new Date(epoch * 1000).toLocaleTimeString(undefined, { hour12: false });
const zoomLabel = (s: number) => (s >= 3600 ? `${s / 3600} h` : `${s / 60} m`);

// Frigate returns one segment per ~10s of recording; merge them into runs
// before drawing or the lane is thousands of Views.
function mergeSegments(segments: RecordingSegment[], span: number): { start: number; end: number }[] {
  const gap = Math.max(30, span * 0.002);
  const out: { start: number; end: number }[] = [];
  for (const seg of segments) {
    const last = out[out.length - 1];
    if (last && seg.start_time - last.end <= gap) last.end = Math.max(last.end, seg.end_time);
    else out.push({ start: seg.start_time, end: seg.end_time });
  }
  return out;
}

export function Timeline({
  camera,
  now,
  playhead,
  onSeek,
  onScrub,
  onRangeChange,
}: {
  camera: string;
  now: number;
  playhead: number | null; // null = live
  onSeek: (epoch: number) => void;
  onScrub?: (epoch: number | null) => void; // null = drag finished
  onRangeChange?: (start: number, end: number) => void; // the loaded stretch
}) {
  // Fixed left edge of the strip, so positions never shift as `now` ticks.
  const [origin] = useState(() => Math.floor(now / 3600) * 3600 - EXTENT);
  const [zoomIdx, setZoomIdx] = useState(5);
  const span = ZOOMS[zoomIdx];
  const [width, setWidth] = useState(0);
  const pps = width ? width / span : 0; // pixels per second
  const x = useCallback((t: number) => (t - origin) * pps + width / 2, [origin, pps, width]);
  const timeAt = useCallback((scrollX: number) => origin + scrollX / (pps || 1), [origin, pps]);

  const scroll = useRef<ScrollView>(null);
  const dragging = useRef(false);
  const settle = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastEmit = useRef(0);
  const [drag, setDrag] = useState<number | null>(null);
  const [centre, setCentre] = useState(playhead ?? now);

  // Load the stretch around the centre in aligned chunks, so scrolling a
  // little re-uses the cached queries instead of refetching.
  const chunk = Math.max(span, 3600);
  const start = Math.floor((centre - span) / chunk) * chunk;
  const end = Math.min(Math.ceil(now / 60) * 60, Math.ceil((centre + span) / chunk) * chunk);
  useEffect(() => {
    onRangeChange?.(start, end);
  }, [start, end, onRangeChange]);

  const { data: segments } = useRecordingSegments(camera, start, end);
  const { data: events } = useEvents({ camera, after: start, before: end, limit: 200 });
  const { data: motion } = useMotion(camera, start, end);

  const runs = useMemo(() => mergeSegments(segments ?? [], span), [segments, span]);
  const ticks = useMemo(() => {
    const list = events ?? [];
    if (list.length <= MAX_EVENT_TICKS) return list;
    const step = Math.ceil(list.length / MAX_EVENT_TICKS);
    return list.filter((_, i) => i % step === 0);
  }, [events]);
  // Motion bars: height is the bucket's share of the busiest bucket loaded.
  const bars = useMemo(() => {
    const list = motion ?? [];
    const peak = Math.max(0, ...list.map((m) => m.motion));
    if (!peak) return [];
    const w = list.length > 1 ? Math.abs(list[1].start_time - list[0].start_time) : 30;
    return list.filter((m) => m.motion > 0).map((m) => ({ start: m.start_time, width: w, level: m.motion / peak }));
  }, [motion]);

  // Playback and the live clock move the strip; a finger on it wins.
  useEffect(() => {
    if (!width || dragging.current) return;
    const t = playhead ?? now;
    scroll.current?.scrollTo({ x: x(t) - width / 2, animated: false });
    setCentre(t);
  }, [playhead, now, x, width]);

  const onScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    if (!dragging.current) return;
    const t = Math.min(now, timeAt(e.nativeEvent.contentOffset.x));
    setDrag(t);
    const ms = Date.now();
    if (ms - lastEmit.current >= SCRUB_EMIT_MS) {
      lastEmit.current = ms;
      setCentre(t);
      onScrub?.(t);
    }
  };
  const finish = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    if (!dragging.current) return;
    dragging.current = false;
    const t = Math.min(now, timeAt(e.nativeEvent.contentOffset.x));
    setDrag(null);
    setCentre(t);
    onScrub?.(null);
    onSeek(t);
  };
  // A drag either stops dead or hands over to momentum; wait a beat to see which.
  const onEndDrag = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    e.persist();
    settle.current = setTimeout(() => finish(e), 80);
  };
  const onMomentumBegin = () => {
    if (settle.current) clearTimeout(settle.current);
  };

  const marker = drag ?? playhead;
  const contentWidth = (now - origin) * pps + width; // half a viewport of slack each side

  // Labels every step across the loaded stretch, aiming for about six in view.
  const step = [60, 300, 600, 1800, 3600, 7200, 14400].find((st) => span / st <= 7) ?? 14400;
  const marks: number[] = [];
  for (let t = Math.ceil(start / step) * step; t < end; t += step) marks.push(t);
  const label = (t: number) => {
    const d = new Date(t * 1000);
    const hh = d.getHours().toString().padStart(2, '0');
    return step >= 3600 ? hh : `${hh}:${d.getMinutes().toString().padStart(2, '0')}`;
  };

  const lanePaint = useMemo(
    () => (
      <>
        {runs.map((run, i) => (
          <View key={i} style={[s.seg, { left: x(run.start), width: Math.max(2, (run.end - run.start) * pps) }]} />
        ))}
        {bars.map((b) => (
          <View
            key={b.start}
            style={[
              s.motion,
              { left: x(b.start), width: Math.max(1.5, b.width * pps), height: `${Math.round(15 + 85 * b.level)}%` },
            ]}
          />
        ))}
        {ticks.map((ev) => (
          <View key={ev.id} style={[s.event, { left: x(ev.start_time), backgroundColor: labelColor(ev.label) }]} />
        ))}
      </>
    ),
    [runs, bars, ticks, x, pps],
  );

  return (
    <View style={s.wrap} onLayout={(e) => setWidth(e.nativeEvent.layout.width)}>
      <View style={s.zoomRow}>
        <Text style={s.scrubTime}>{drag !== null ? hhmmss(drag) : ''}</Text>
        <View style={s.zoom}>
          <Pressable style={s.zoomBtn} onPress={() => setZoomIdx((i) => Math.max(0, i - 1))} accessibilityLabel="Zoom in">
            <Text style={s.zoomText}>+</Text>
          </Pressable>
          <Text style={s.zoomLabel}>{zoomLabel(span)}</Text>
          <Pressable
            style={s.zoomBtn}
            onPress={() => setZoomIdx((i) => Math.min(ZOOMS.length - 1, i + 1))}
            accessibilityLabel="Zoom out"
          >
            <Text style={s.zoomText}>−</Text>
          </Pressable>
        </View>
      </View>

      {width ? (
        <View>
          <ScrollView
            ref={scroll}
            horizontal
            showsHorizontalScrollIndicator={false}
            scrollEventThrottle={32}
            onScroll={onScroll}
            onScrollBeginDrag={() => {
              if (settle.current) clearTimeout(settle.current);
              dragging.current = true;
            }}
            onScrollEndDrag={onEndDrag}
            onMomentumScrollBegin={onMomentumBegin}
            onMomentumScrollEnd={finish}
            contentContainerStyle={{ width: contentWidth }}
          >
            <Pressable
              style={s.content}
              onPress={(e) => onSeek(Math.min(now, origin + (e.nativeEvent.locationX - width / 2) / pps))}
            >
              <View style={s.hours}>
                {marks.map((t) => (
                  <Text key={t} style={[s.hourText, { left: x(t) }]}>
                    {label(t)}
                  </Text>
                ))}
              </View>
              <View style={s.lane}>
                <View style={[s.recorded, { left: x(origin), width: (now - origin) * pps }]} />
                {lanePaint}
              </View>
            </Pressable>
          </ScrollView>
          <View style={[s.playhead, { left: width / 2 - 1 }]} pointerEvents="none">
            {marker === null ? (
              <View style={s.nowBadge}>
                <Text style={s.nowText}>NOW</Text>
              </View>
            ) : (
              <View style={[s.grip, drag !== null && s.gripActive]} />
            )}
          </View>
        </View>
      ) : null}
    </View>
  );
}

const s = StyleSheet.create({
  wrap: { gap: 4 },
  zoomRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', height: 22 },
  scrubTime: { fontFamily: fonts.monoSemiBold, fontSize: 11, color: colors.accent },
  zoom: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  zoomBtn: { width: 24, height: 22, alignItems: 'center', justifyContent: 'center', borderRadius: 6, backgroundColor: colors.fill },
  zoomText: { fontFamily: fonts.monoSemiBold, fontSize: 13, color: colors.textLabel },
  zoomLabel: { fontFamily: fonts.mono, fontSize: 11, color: colors.textMuted, minWidth: 34, textAlign: 'center' },
  content: { flex: 1 },
  hours: { height: 16 },
  hourText: { position: 'absolute', fontFamily: fonts.mono, fontSize: 10.5, color: colors.textGhost },
  lane: {
    height: 48, // finger-sized: the whole lane is the drag target
    borderRadius: 7,
    backgroundColor: '#F4F6F7',
    overflow: 'hidden',
  },
  recorded: { position: 'absolute', top: 0, bottom: 0, backgroundColor: '#F4F6F7' },
  seg: { position: 'absolute', top: 0, bottom: 0, backgroundColor: '#C9D2D6' },
  motion: { position: 'absolute', bottom: 0, backgroundColor: 'rgba(27,94,90,0.45)', borderRadius: 1 },
  event: { position: 'absolute', top: 0, bottom: 0, width: 5, borderRadius: 3, borderWidth: 1, borderColor: '#fff' },
  playhead: {
    position: 'absolute',
    top: 16,
    bottom: 0,
    width: 2,
    backgroundColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  grip: { width: 12, height: 26, borderRadius: 6, backgroundColor: colors.accent, borderWidth: 2, borderColor: '#fff' },
  gripActive: { width: 16, height: 34, borderRadius: 8 },
  nowBadge: {
    position: 'absolute',
    top: -2,
    backgroundColor: colors.accent,
    borderRadius: 5,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  nowText: { color: '#fff', fontFamily: fonts.monoSemiBold, fontSize: 9, letterSpacing: 0.5 },
});
