import { Image } from 'expo-image';
import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable, SectionList, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Chip, Mono } from '@/components/ui';
import type { FrigateEvent } from '@/lib/frigate';
import { useCameras, useEvents, useFrigate } from '@/lib/queries';
import { colors, fonts, labelColor } from '@/theme';

const dayKey = (t: number) => new Date(t * 1000).toDateString();

const dayTitle = (t: number) => {
  const d = new Date(t * 1000);
  const today = new Date();
  const yesterday = new Date(Date.now() - 86_400_000);
  const label = d.toLocaleDateString(undefined, { weekday: 'short', day: '2-digit', month: 'short' });
  if (d.toDateString() === today.toDateString()) return `Today · ${label}`;
  if (d.toDateString() === yesterday.toDateString()) return `Yesterday · ${label}`;
  return label;
};

// Design screen 2c: filterable events list; detail is its own screen on mobile.
export default function Events() {
  const fg = useFrigate();
  const { cameras } = useCameras();
  const [label, setLabel] = useState<string | undefined>();
  const [camera, setCamera] = useState<string | undefined>();

  const [after] = useState(() => Math.floor(Date.now() / 1000) - 7 * 86_400);
  const { data: events, isLoading } = useEvents({ after, limit: 200, label, camera });

  const labelCounts = useMemo(() => {
    const counts = new Map<string, number>();
    (events ?? []).forEach((e) => counts.set(e.label, (counts.get(e.label) ?? 0) + 1));
    return [...counts.entries()].sort((a, b) => b[1] - a[1]);
  }, [events]);

  const sections = useMemo(() => {
    const byDay = new Map<string, FrigateEvent[]>();
    (events ?? []).forEach((e) => {
      const k = dayKey(e.start_time);
      byDay.set(k, [...(byDay.get(k) ?? []), e]);
    });
    return [...byDay.values()].map((list) => ({ title: dayTitle(list[0].start_time), data: list }));
  }, [events]);

  if (!fg) return null;

  return (
    <SafeAreaView style={s.safe} edges={['top']}>
      <View style={s.header}>
        <Text style={s.title}>Events</Text>
        <Mono>{events ? `${events.length} in the last 7 days` : ''}</Mono>
      </View>

      <View style={s.filters}>
        <Chip label="All" active={!label} onPress={() => setLabel(undefined)} />
        {labelCounts.map(([l, n]) => (
          <Chip
            key={l}
            label={`${l[0].toUpperCase()}${l.slice(1)} ${n}`}
            dotColor={labelColor(l)}
            active={label === l}
            onPress={() => setLabel(label === l ? undefined : l)}
          />
        ))}
      </View>
      {cameras.length > 1 ? (
        <View style={s.filters}>
          <Chip label="All cameras" active={!camera} onPress={() => setCamera(undefined)} />
          {cameras.map((c) => (
            <Chip
              key={c}
              label={c.replace(/_/g, ' ')}
              active={camera === c}
              onPress={() => setCamera(camera === c ? undefined : c)}
            />
          ))}
        </View>
      ) : null}

      <SectionList
        sections={sections}
        keyExtractor={(e) => e.id}
        stickySectionHeadersEnabled={false}
        contentContainerStyle={{ paddingBottom: 24 }}
        ListEmptyComponent={
          <Text style={s.empty}>{isLoading ? 'Loading events…' : 'No events in this window.'}</Text>
        }
        renderSectionHeader={({ section }) => <Text style={s.day}>{section.title}</Text>}
        renderItem={({ item }) => <EventRow event={item} thumbUrl={fg.eventThumbUrl(item.id)} />}
      />
    </SafeAreaView>
  );
}

function EventRow({ event, thumbUrl }: { event: FrigateEvent; thumbUrl: string }) {
  const time = new Date(event.start_time * 1000).toLocaleTimeString(undefined, {
    hour: '2-digit',
    minute: '2-digit',
  });
  const dur = event.end_time ? `${Math.round(event.end_time - event.start_time)} s` : 'ongoing';
  const score = event.data?.top_score ?? event.top_score;

  return (
    <Pressable
      style={s.row}
      onPress={() => router.push({ pathname: '/event/[id]', params: { id: event.id } })}
    >
      <View style={s.thumb}>
        <Image source={{ uri: thumbUrl }} style={StyleSheet.absoluteFill} contentFit="cover" />
      </View>
      <View style={s.rowMain}>
        <View style={s.labelRow}>
          <View style={[s.chipDot, { backgroundColor: labelColor(event.label) }]} />
          <Text style={s.label}>
            {event.label[0].toUpperCase() + event.label.slice(1)}
            {event.sub_label ? ` · ${event.sub_label}` : ''}
          </Text>
        </View>
        <Text style={s.sub} numberOfLines={1}>
          {event.camera.replace(/_/g, ' ')}
          {event.zones.length ? ` · ${event.zones.join(', ')}` : ''}
        </Text>
      </View>
      <View style={s.rowRight}>
        <Mono style={s.time}>{time}</Mono>
        <Mono>{score ? `${Math.round(score * 100)}%` : dur}</Mono>
      </View>
    </Pressable>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.paper },
  header: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  title: { fontSize: 17, fontFamily: fonts.sansSemiBold, color: colors.ink },
  filters: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    paddingHorizontal: 16,
    paddingBottom: 8,
  },
  day: {
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 6,
    fontSize: 11,
    fontFamily: fonts.sansSemiBold,
    letterSpacing: 1.3,
    textTransform: 'uppercase',
    color: colors.textFaint,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  thumb: {
    width: 96,
    height: 60,
    borderRadius: 8,
    overflow: 'hidden',
    backgroundColor: colors.tile,
  },
  rowMain: { flex: 1, gap: 4, minWidth: 0 },
  labelRow: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  chipDot: { width: 8, height: 8, borderRadius: 2 },
  label: { fontSize: 13.5, fontFamily: fonts.sansSemiBold, color: colors.ink },
  sub: { fontSize: 12, color: colors.textFaint, fontFamily: fonts.sans },
  rowRight: { alignItems: 'flex-end', gap: 4 },
  time: { fontSize: 12.5, color: colors.textBody },
  empty: {
    textAlign: 'center',
    marginTop: 48,
    color: colors.textFaint,
    fontFamily: fonts.sans,
    fontSize: 14,
  },
});
