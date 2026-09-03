import { useEventListener } from 'expo';
import { Image } from 'expo-image';
import { useVideoPlayer, VideoView } from 'expo-video';
import { forwardRef, useImperativeHandle, useMemo, useRef, useState } from 'react';
import { StyleSheet } from 'react-native';

import type { FrigateClient, PreviewClip } from '@/lib/frigate';

export type ScrubPreviewHandle = { seek: (epoch: number) => void };

// What the Frigate web UI does while you drag its timeline: hold one low-res
// preview clip open and move its currentTime, so a scrub costs a local seek
// instead of an HTTP round trip per frame. Seeks arrive through a ref rather
// than props, so dragging never re-renders the console around it.
//
// Cameras without cached previews fall back to recording stills, which are
// slower but exist on every Frigate.
export const ScrubPreview = forwardRef<ScrubPreviewHandle, { fg: FrigateClient; camera: string; clips: PreviewClip[] }>(
  function ScrubPreview({ fg, camera, clips }, ref) {
    const [clip, setClip] = useState<PreviewClip | null>(null);
    const [frameAt, setFrameAt] = useState<number | null>(null);
    // Seeks land before the clip finishes loading; hold the last one and
    // apply it once the player is ready.
    const pending = useRef<number | null>(null);

    const source = useMemo(
      () => (clip ? { uri: fg.previewUrl(clip.src), headers: fg.authHeaders } : null),
      [clip, fg],
    );

    const player = useVideoPlayer(source, (p) => {
      p.muted = true;
      p.pause();
    });

    useEventListener(player, 'statusChange', ({ status }) => {
      if (status !== 'readyToPlay' || pending.current === null) return;
      player.currentTime = pending.current;
      pending.current = null;
    });

    useImperativeHandle(
      ref,
      () => ({
        seek: (epoch: number) => {
          const hit = clips.find((c) => epoch >= c.start && epoch <= c.end);
          if (!hit) {
            // No preview covers this moment: quantise so a slow drag re-uses
            // stills already in the image cache.
            setFrameAt(Math.round(epoch / 2) * 2);
            setClip(null);
            return;
          }
          const offset = Math.max(0, epoch - hit.start);
          if (hit.src !== clip?.src) {
            pending.current = offset;
            setClip(hit);
            return;
          }
          if (player.status === 'readyToPlay') player.currentTime = offset;
          else pending.current = offset;
        },
      }),
      [clips, clip, player],
    );

    if (clip) {
      return <VideoView player={player} style={StyleSheet.absoluteFill} nativeControls={false} contentFit="contain" />;
    }
    if (frameAt === null) return null;
    return (
      <Image
        // Deliberately not keyed by uri: expo-image keeps the previous still
        // on screen until the next decodes, so the scrub does not blink.
        source={{ uri: fg.recordingFrameUrl(camera, frameAt), headers: fg.authHeaders }}
        style={StyleSheet.absoluteFill}
        contentFit="contain"
        transition={0}
        cachePolicy="memory-disk"
      />
    );
  },
);
