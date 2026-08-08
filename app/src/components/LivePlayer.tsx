import { Image } from 'expo-image';
import { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { colors, fonts } from '@/theme';

// Live view via libVLC (hardware-decoded RTSP). The native module only
// exists in a dev build; when it is missing (Expo Go, web) we fall back to
// polling snapshots so every screen still renders.
let VLCPlayer: any = null;
try {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  VLCPlayer = require('react-native-vlc-media-player').VLCPlayer;
} catch {
  VLCPlayer = null;
}

export function LivePlayer({
  rtspUrl,
  snapshotUrl,
  headers,
  style,
}: {
  rtspUrl: string;
  snapshotUrl: string;
  headers?: Record<string, string>;
  style?: object;
}) {
  const [vlcFailed, setVlcFailed] = useState(false);
  const useVlc = VLCPlayer && !vlcFailed;
  const [tick, setTick] = useState(0);

  useEffect(() => {
    if (useVlc) return;
    const t = setInterval(() => setTick((v) => v + 1), 1000);
    return () => clearInterval(t);
  }, [useVlc]);

  if (useVlc) {
    return (
      <VLCPlayer
        style={[s.fill, style]}
        source={{ uri: rtspUrl }}
        autoplay
        onError={() => setVlcFailed(true)}
      />
    );
  }

  return (
    <View style={[s.fill, style]}>
      <Image
        source={{ uri: `${snapshotUrl}${snapshotUrl.includes('?') ? '&' : '?'}t=${tick}`, headers }}
        style={StyleSheet.absoluteFill}
        contentFit="contain"
      />
      <View style={s.note}>
        <Text style={s.noteText}>
          {VLCPlayer ? 'RTSP failed — showing snapshots' : 'snapshot mode (dev build needed for RTSP)'}
        </Text>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  fill: { flex: 1, backgroundColor: colors.tile },
  note: {
    position: 'absolute',
    bottom: 10,
    alignSelf: 'center',
    backgroundColor: colors.overlay,
    borderRadius: 7,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  noteText: { color: colors.videoText, fontSize: 11, fontFamily: fonts.mono },
});
