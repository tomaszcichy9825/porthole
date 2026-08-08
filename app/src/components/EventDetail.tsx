import { useVideoPlayer, VideoView } from 'expo-video';
import { router } from 'expo-router';
import { Alert, Pressable, ScrollView, Share, StyleSheet, Text, View } from 'react-native';

import { Card, Mono } from '@/components/ui';
import { useEvent, useFrigate } from '@/lib/queries';
import { colors, fonts, radius } from '@/theme';

// Design screen 2c right pane: the selected event, playing natively.
// Used as the split-view pane on wide layouts and by the /event/[id]
// route on phones.
export function EventDetail({ id, onDeleted }: { id: string; onDeleted?: () => void }) {
  const fg = useFrigate();
  const { data: event } = useEvent(id);

  const clipSource = fg && id ? { uri: fg.eventClipUrl(id), headers: fg.authHeaders } : null;
  const player = useVideoPlayer(clipSource, (p) => {
    p.play();
  });

  if (!fg || !event) return null;

  const score = event.data?.top_score ?? event.top_score;
  const time = (t: number) =>
    new Date(t * 1000).toLocaleTimeString(undefined, {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
  const dur = event.end_time ? `${Math.round(event.end_time - event.start_time)} s` : 'ongoing';

  const del = () =>
    Alert.alert('Delete event', 'Remove this event and its clip from Frigate?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          await fg.deleteEvent(event.id);
          onDeleted?.();
        },
      },
    ]);

  return (
    <ScrollView contentContainerStyle={s.scroll}>
      <View style={s.stage}>
        <VideoView player={player} style={{ flex: 1 }} nativeControls contentFit="contain" />
      </View>

      <View style={s.titleRow}>
        <View style={{ gap: 5, flex: 1 }}>
          <Text style={s.title}>
            {event.label[0].toUpperCase() + event.label.slice(1)} ·{' '}
            {event.camera.replace(/_/g, ' ')}
          </Text>
          <Mono style={s.timeRange}>
            {time(event.start_time)}
            {event.end_time ? ` → ${time(event.end_time)}` : ''} · {dur}
          </Mono>
        </View>
        {score ? (
          <View style={s.score}>
            <Mono style={s.scoreText}>{Math.round(score * 100)}%</Mono>
          </View>
        ) : null}
      </View>

      <Card>
        <MetaRow label="Zones" value={event.zones.length ? event.zones.join(', ') : '—'} alt />
        <MetaRow label="Sub label" value={event.sub_label ?? '—'} />
        {event.data?.recognized_license_plate ? (
          <MetaRow label="Plate" value={event.data.recognized_license_plate} alt mono />
        ) : null}
        <MetaRow label="Event id" value={event.id} mono alt={!event.data?.recognized_license_plate} />
      </Card>

      <View style={s.actions}>
        <Pressable
          style={s.primary}
          onPress={() =>
            router.push({
              pathname: '/camera/[name]',
              params: { name: event.camera, at: String(Math.floor(event.start_time)) },
            })
          }
        >
          <Text style={s.primaryText}>Open in timeline</Text>
        </Pressable>
        <Pressable
          style={s.iconBtn}
          onPress={() => Share.share({ message: fg.eventClipUrl(event.id) })}
        >
          <Text style={s.iconBtnText}>Share</Text>
        </Pressable>
        <Pressable style={[s.iconBtn, s.deleteBtn]} onPress={del}>
          <Text style={s.deleteText}>Delete</Text>
        </Pressable>
      </View>
    </ScrollView>
  );
}

function MetaRow({
  label,
  value,
  mono = false,
  alt = false,
}: {
  label: string;
  value: string;
  mono?: boolean;
  alt?: boolean;
}) {
  return (
    <View style={[m.row, alt && m.alt]}>
      <Text style={m.label}>{label}</Text>
      <Text style={[m.value, mono && m.mono]} numberOfLines={1}>
        {value}
      </Text>
    </View>
  );
}

const m = StyleSheet.create({
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 13,
    paddingVertical: 11,
  },
  alt: { backgroundColor: '#FBFCFC' },
  label: { fontSize: 12.5, color: colors.textFaint, fontFamily: fonts.sans },
  value: { fontSize: 12.5, fontFamily: fonts.sansMedium, color: colors.ink, flexShrink: 1 },
  mono: { fontFamily: fonts.mono, color: colors.textMuted },
});

const s = StyleSheet.create({
  scroll: { padding: 16, gap: 14 },
  stage: {
    borderRadius: radius.lg,
    overflow: 'hidden',
    aspectRatio: 16 / 9,
    backgroundColor: colors.tile,
  },
  titleRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  title: { fontSize: 19, fontFamily: fonts.sansSemiBold, color: colors.ink, letterSpacing: -0.4 },
  timeRange: { fontSize: 12, color: colors.textMuted },
  score: {
    backgroundColor: colors.accentSoft,
    borderRadius: 7,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  scoreText: { fontSize: 12, color: colors.accent },
  actions: { flexDirection: 'row', gap: 8 },
  primary: {
    flex: 1,
    height: 40,
    borderRadius: radius.md,
    backgroundColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryText: { color: '#fff', fontSize: 12.5, fontFamily: fonts.sansSemiBold },
  iconBtn: {
    height: 40,
    paddingHorizontal: 14,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.card,
  },
  iconBtnText: { fontSize: 12.5, fontFamily: fonts.sansSemiBold, color: colors.textLabel },
  deleteBtn: { borderColor: colors.dangerSoft, backgroundColor: colors.dangerSoft },
  deleteText: { fontSize: 12.5, fontFamily: fonts.sansSemiBold, color: colors.danger },
});
