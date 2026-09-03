import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { LivePlayer } from '@/components/LivePlayer';
import { LiveBadge } from '@/components/ui';
import { colors, fonts } from '@/theme';

// Grid tile: a real live stream (sub stream by default), falling back to
// 1 fps snapshots when RTSP is out of reach.
export function CameraTile({
  name,
  rtspUrl,
  snapshotUrl,
  headers,
  resolution,
  onPress,
}: {
  name: string;
  rtspUrl: string;
  snapshotUrl: string;
  headers?: Record<string, string>;
  resolution?: string;
  onPress: () => void;
}) {
  const [mode, setMode] = useState<'live' | 'snap'>('snap');
  const title = name.replace(/_/g, ' ').replace(/^./, (c) => c.toUpperCase());

  return (
    <Pressable onPress={onPress} style={s.tile}>
      <LivePlayer
        rtspUrl={rtspUrl}
        snapshotUrl={snapshotUrl}
        headers={headers}
        style={StyleSheet.absoluteFill}
        compact
        onModeChange={setMode}
      />
      <View style={s.overlayRow} pointerEvents="none">
        <View style={s.nameBadge}>
          <Text style={s.nameText}>{title}</Text>
        </View>
        <LiveBadge kind={mode} />
      </View>
      {resolution ? (
        <View style={s.footRow} pointerEvents="none">
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
});
