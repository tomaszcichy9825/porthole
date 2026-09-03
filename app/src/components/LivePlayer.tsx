import { Image } from 'expo-image';
import { memo, useCallback, useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { colors, fonts } from '@/theme';

// Live view via libVLC (hardware-decoded RTSP), falling back to 1 fps
// snapshots when the stream never comes up. The native module only exists
// in a dev build; without it (Expo Go, web) snapshots are all there is.
//
// Mac note: libVLC's RTSP client (live555) finds its own IP by sending
// itself a multicast packet, then by resolving the hostname. In the
// iOS-on-Mac sandbox both need the app's Local Network permission
// (System Settings > Privacy & Security > Local Network); without it the
// log says "Unable to determine our source address" and the stage stays
// black, so the fallback below takes over.
let VLCPlayer: any = null;
try {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  VLCPlayer = require('react-native-vlc-media-player').VLCPlayer;
} catch {
  VLCPlayer = null;
}

const RTSP_GRACE_MS = 8000;

type VlcEvents = {
  onLoad: (e: { videoSize?: { width: number; height: number } }) => void;
  onPlaying: () => void;
  onError: () => void;
};

// The native player tears itself down and reconnects on every `source` it
// receives, and VLCPlayer writes into that object during render, so:
// - memo: this only re-renders when the stream or mute actually changes;
//   a parent re-render (playhead tick, thumbnail refresh) must not restart
//   the stream. Rapid restarts also raced VLC's input thread into a
//   segfault (strdup(NULL) in InputSourceNew).
// - 'use no memo': when it does re-render, VLC gets a fresh object rather
//   than the one React Native froze after the previous commit.
const Vlc = memo(function Vlc({
  url,
  muted,
  style,
  onLoad,
  onPlaying,
  onError,
}: { url: string; muted: boolean; style?: object } & VlcEvents) {
  'use no memo';
  return (
    <VLCPlayer
      style={[s.fill, style]}
      // RTP over TCP survives VPNs and proxies; UDP is the libvlc default.
      source={{ uri: url, initOptions: ['--rtsp-tcp'] }}
      autoplay
      muted={muted}
      onLoad={onLoad}
      onPlaying={onPlaying}
      onProgress={onPlaying}
      onError={onError}
    />
  );
});

export function LivePlayer({
  rtspUrl,
  snapshotUrl,
  headers,
  style,
  muted = true,
  compact = false,
  onVideoSize,
  onModeChange,
}: {
  rtspUrl: string;
  snapshotUrl: string;
  headers?: Record<string, string>;
  style?: object;
  muted?: boolean;
  compact?: boolean; // grid tile: no fallback note
  onVideoSize?: (url: string, width: number, height: number) => void;
  onModeChange?: (mode: 'live' | 'snap') => void;
}) {
  // Failure and first-frame state are remembered per stream URL, so a new
  // stream (other camera, main/sub switch) gets a fresh VLC attempt.
  const [failedUrl, setFailedUrl] = useState<string | null>(null);
  const [playingUrl, setPlayingUrl] = useState<string | null>(null);
  const useVlc = VLCPlayer && failedUrl !== rtspUrl;
  const playing = playingUrl === rtspUrl;
  const [tick, setTick] = useState(0);

  useEffect(() => {
    onModeChange?.(useVlc ? 'live' : 'snap');
    if (useVlc) return;
    const t = setInterval(() => setTick((v) => v + 1), 1000);
    return () => clearInterval(t);
  }, [useVlc, onModeChange]);

  // VLC stays silent when a stream never comes up (black, no onError).
  useEffect(() => {
    if (!useVlc || playing) return;
    const t = setTimeout(() => setFailedUrl(rtspUrl), RTSP_GRACE_MS);
    return () => clearTimeout(t);
  }, [useVlc, playing, rtspUrl]);

  // Stable per URL, so Vlc's memo holds between parent renders.
  const onLoad = useCallback<VlcEvents['onLoad']>(
    (e) => {
      if (e?.videoSize?.width) onVideoSize?.(rtspUrl, e.videoSize.width, e.videoSize.height);
    },
    [rtspUrl, onVideoSize],
  );
  const onPlaying = useCallback(() => setPlayingUrl(rtspUrl), [rtspUrl]);
  const onError = useCallback(() => setFailedUrl(rtspUrl), [rtspUrl]);

  if (useVlc) {
    return <Vlc url={rtspUrl} muted={muted} style={style} onLoad={onLoad} onPlaying={onPlaying} onError={onError} />;
  }

  return (
    <View style={[s.fill, style]}>
      <Image
        source={{ uri: `${snapshotUrl}${snapshotUrl.includes('?') ? '&' : '?'}t=${tick}`, headers }}
        style={StyleSheet.absoluteFill}
        contentFit="contain"
      />
      {compact ? null : (
        <View style={s.note}>
          <Text style={s.noteText}>
            {VLCPlayer ? 'RTSP stream not reachable — showing snapshots' : 'snapshot mode (dev build needed for RTSP)'}
          </Text>
        </View>
      )}
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
