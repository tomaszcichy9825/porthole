import type { ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { colors, fonts, radius } from '@/theme';

export function Chip({
  label,
  active = false,
  dotColor,
  onPress,
}: {
  label: string;
  active?: boolean;
  dotColor?: string;
  onPress?: () => void;
}) {
  return (
    <Pressable onPress={onPress} style={[s.chip, active && s.chipActive]}>
      {dotColor ? <View style={[s.chipDot, { backgroundColor: dotColor }]} /> : null}
      <Text style={[s.chipText, active && s.chipTextActive]}>{label}</Text>
    </Pressable>
  );
}

export function Segmented<T extends string>({
  options,
  value,
  onChange,
  mono = false,
}: {
  options: readonly T[];
  value: T;
  onChange: (v: T) => void;
  mono?: boolean;
}) {
  return (
    <View style={s.seg}>
      {options.map((o) => (
        <Pressable key={o} onPress={() => onChange(o)} style={[s.segItem, o === value && s.segItemActive]}>
          <Text
            style={[
              s.segText,
              mono && { fontFamily: fonts.monoSemiBold },
              o === value && s.segTextActive,
            ]}
          >
            {o}
          </Text>
        </Pressable>
      ))}
    </View>
  );
}

export function Card({ children, style }: { children: ReactNode; style?: object }) {
  return <View style={[s.card, style]}>{children}</View>;
}

export function Mono({ children, style }: { children: ReactNode; style?: object }) {
  return <Text style={[s.mono, style]}>{children}</Text>;
}

export function LiveBadge({ kind = 'live' }: { kind?: 'live' | 'snap' }) {
  const live = kind === 'live';
  return (
    <View style={[s.liveBadge, !live && s.snapBadge]}>
      <Text style={[s.liveBadgeText, !live && s.snapBadgeText]}>{live ? 'LIVE' : 'SNAP'}</Text>
    </View>
  );
}

const s = StyleSheet.create({
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 8,
    backgroundColor: colors.fill,
  },
  chipActive: { backgroundColor: colors.accentSoft },
  chipDot: { width: 8, height: 8, borderRadius: 2 },
  chipText: { fontFamily: fonts.sansMedium, fontSize: 12.5, color: colors.textBody },
  chipTextActive: { fontFamily: fonts.sansSemiBold, color: colors.accent },

  seg: {
    flexDirection: 'row',
    backgroundColor: colors.fill,
    borderRadius: radius.md,
    padding: 3,
    gap: 2,
    alignSelf: 'flex-start',
  },
  segItem: { paddingHorizontal: 11, paddingVertical: 6, borderRadius: 6 },
  segItemActive: {
    backgroundColor: colors.card,
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowRadius: 2,
    shadowOffset: { width: 0, height: 1 },
    elevation: 1,
  },
  segText: { fontFamily: fonts.sansSemiBold, fontSize: 12, color: colors.textMuted },
  segTextActive: { color: colors.ink },

  card: {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.xl,
  },

  mono: { fontFamily: fonts.mono, fontSize: 11.5, color: colors.textFaint },

  liveBadge: {
    backgroundColor: colors.live,
    borderRadius: 7,
    paddingHorizontal: 9,
    paddingVertical: 5,
  },
  liveBadgeText: {
    color: colors.liveInk,
    fontSize: 11,
    fontFamily: fonts.sansBold,
    letterSpacing: 0.55,
  },
  snapBadge: { backgroundColor: colors.overlay },
  snapBadgeText: { color: '#B9C4C8' },
});
