import { useCallback, useMemo, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import type { FrigateEvent, RecordingSegment } from '@/lib/frigate';
import { colors, fonts, labelColor } from '@/theme';

// Frigate returns one segment per ~10s of recording - thousands per day.
// Rendering a View per segment freezes the UI, so merge near-contiguous
// segments into runs before drawing, and cap the number of event ticks.
const MAX_EVENT_TICKS = 120;

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

// One-lane timeline for the camera console (design 1c, single camera on
// mobile). Grey blocks are recorded ranges, coloured ticks are events,
// the teal edge is NOW. Tap anywhere to jump to that moment.
export function Timeline({
  windowStart,
  windowEnd,
  segments,
  events,
  playhead,
  onSeek,
}: {
  windowStart: number;
  windowEnd: number;
  segments: RecordingSegment[];
  events: FrigateEvent[];
  playhead: number | null; // null = live
  onSeek: (epoch: number) => void;
}) {
  const span = windowEnd - windowStart;
  const [width, setWidth] = useState(0);

  const pct = useCallback(
    (t: number) => Math.min(100, Math.max(0, ((t - windowStart) / span) * 100)),
    [windowStart, span],
  );

  const runs = useMemo(() => mergeSegments(segments, span), [segments, span]);
  const ticks = useMemo(() => {
    if (events.length <= MAX_EVENT_TICKS) return events;
    const step = Math.ceil(events.length / MAX_EVENT_TICKS);
    return events.filter((_, i) => i % step === 0);
  }, [events]);

  const hourMarks: number[] = [];
  for (let t = Math.ceil(windowStart / 3600) * 3600; t < windowEnd; t += 3600) hourMarks.push(t);
  const showEvery = Math.max(1, Math.ceil(hourMarks.length / 6));

  return (
    <View style={s.wrap}>
      <View style={s.hours}>
        {hourMarks
          .filter((_, i) => i % showEvery === 0)
          .map((t) => (
            <Text key={t} style={[s.hourText, { left: `${pct(t)}%` }]}>
              {new Date(t * 1000).getHours().toString().padStart(2, '0')}
            </Text>
          ))}
      </View>

      <View
        style={s.lane}
        onLayout={(e) => setWidth(e.nativeEvent.layout.width)}
        onStartShouldSetResponder={() => true}
        onResponderRelease={(e) => {
          if (!width) return;
          const ratio = Math.min(1, Math.max(0, e.nativeEvent.locationX / width));
          onSeek(windowStart + ratio * span);
        }}
      >
        {runs.map((run, i) => (
          <View
            key={i}
            style={[
              s.seg,
              {
                left: `${pct(run.start)}%`,
                width: `${Math.max(0.4, pct(run.end) - pct(run.start))}%`,
              },
            ]}
          />
        ))}
        {ticks.map((ev) => (
          <View
            key={ev.id}
            style={[s.event, { left: `${pct(ev.start_time)}%`, backgroundColor: labelColor(ev.label) }]}
          />
        ))}
        {playhead !== null ? (
          <View style={[s.playhead, { left: `${pct(playhead)}%` }]} />
        ) : (
          <View style={[s.playhead, s.nowEdge]}>
            <View style={s.nowBadge}>
              <Text style={s.nowText}>NOW</Text>
            </View>
          </View>
        )}
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  wrap: { gap: 4 },
  hours: { height: 16, position: 'relative' },
  hourText: {
    position: 'absolute',
    fontFamily: fonts.mono,
    fontSize: 10.5,
    color: colors.textGhost,
  },
  lane: {
    height: 40,
    borderRadius: 7,
    backgroundColor: '#F4F6F7',
    overflow: 'hidden',
    position: 'relative',
  },
  seg: { position: 'absolute', top: 0, bottom: 0, backgroundColor: '#C9D2D6' },
  event: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    width: 5,
    borderRadius: 3,
    borderWidth: 1,
    borderColor: '#fff',
  },
  playhead: { position: 'absolute', top: 0, bottom: 0, width: 2, backgroundColor: colors.accent },
  nowEdge: { right: 0, left: undefined },
  nowBadge: {
    position: 'absolute',
    top: -2,
    right: 0,
    backgroundColor: colors.accent,
    borderRadius: 5,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  nowText: { color: '#fff', fontFamily: fonts.monoSemiBold, fontSize: 9, letterSpacing: 0.5 },
});
