import { Image } from 'expo-image';
import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { LiveBadge } from '@/components/ui';
import { colors, fonts } from '@/theme';

// Grid tile. Polls latest.jpg — only the fullscreen console holds a real
// stream (design principle: visible tiles are cheap, the console is live).
export function CameraTile({
  name,
  snapshotUrl,
  resolution,
  onPress,
  refreshMs = 5000,
}: {
  name: string;
  snapshotUrl: string;
  resolution?: string;
  onPress: () => void;
  refreshMs?: number;
}) {
  const [tick, setTick] = useState(() => Math.floor(Date.now() / refreshMs));
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    const t = setInterval(() => setTick((v) => v + 1), refreshMs);
    return () => clearInterval(t);
  }, [refreshMs]);

  const title = name.replace(/_/g, ' ').replace(/^./, (c) => c.toUpperCase());

  return (
    <Pressable onPress={onPress} style={s.tile}>
      {failed ? (
        <View style={s.dead}>
          <Text style={s.deadTitle}>{title} unreachable</Text>
          <Text style={s.deadSub}>retrying…</Text>
        </View>
      ) : (
        <Image
          source={{ uri: `${snapshotUrl}${snapshotUrl.includes('?') ? '&' : '?'}t=${tick}` }}
          style={StyleSheet.absoluteFill}
          contentFit="cover"
          transition={150}
          onError={() => setFailed(true)}
          onLoad={() => setFailed(false)}
        />
      )}
      <View style={s.overlayRow}>
        <View style={s.nameBadge}>
          <Text style={s.nameText}>{title}</Text>
        </View>
        <LiveBadge kind="snap" />
      </View>
      {resolution ? (
        <View style={s.footRow}>
          <Text style={s.footText}>{resolution}</Text>
        </View>
      ) : null}
    </Pressable>
  );
}

const s = StyleSheet.create({
  tile: {
    flex: 1,
    aspectRatio: 16 / 9,
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: colors.tile,
  },
  overlayRow: {
    position: 'absolute',
    top: 10,
    left: 10,
    right: 10,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 6,
  },
  nameBadge: {
    backgroundColor: colors.overlay,
    borderRadius: 7,
    paddingHorizontal: 9,
    paddingVertical: 5,
    flexShrink: 1,
  },
  nameText: { color: '#fff', fontSize: 12, fontFamily: fonts.sansSemiBold },
  footRow: { position: 'absolute', bottom: 8, right: 10 },
  footText: {
    fontFamily: fonts.mono,
    fontSize: 10.5,
    color: colors.videoText,
    textShadowColor: 'rgba(0,0,0,0.7)',
    textShadowRadius: 8,
  },
  dead: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: '#0E1214',
  },
  deadTitle: { color: '#B9C4C8', fontSize: 13, fontFamily: fonts.sansSemiBold },
  deadSub: { color: '#7C8A8F', fontSize: 11, fontFamily: fonts.mono },
});
