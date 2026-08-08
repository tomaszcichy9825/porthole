import { router, usePathname } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, Path, Rect } from 'react-native-svg';

import { Mark } from '@/components/Mark';
import { useActiveServer } from '@/stores/servers';
import { colors, fonts } from '@/theme';

// Desktop rail from the design (Rail.dc.html): 76px, mark on top,
// Cameras / Events / Settings, server initials at the bottom.
const items = [
  { key: 'cameras', label: 'Cameras', href: '/(tabs)/cameras' },
  { key: 'events', label: 'Events', href: '/(tabs)/events' },
  { key: 'settings', label: 'Settings', href: '/(tabs)/settings' },
] as const;

function ItemIcon({ name, color }: { name: string; color: string }) {
  if (name === 'cameras')
    return (
      <Svg width={19} height={19} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={1.8}>
        <Rect x={3} y={4} width={8} height={7} rx={1.5} />
        <Rect x={13} y={4} width={8} height={7} rx={1.5} />
        <Rect x={3} y={13} width={8} height={7} rx={1.5} />
        <Rect x={13} y={13} width={8} height={7} rx={1.5} />
      </Svg>
    );
  if (name === 'events')
    return (
      <Svg width={19} height={19} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={1.8}>
        <Path d="M4 6h16M4 12h16M4 18h10" />
      </Svg>
    );
  return (
    <Svg width={19} height={19} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={1.8}>
      <Circle cx={12} cy={12} r={3} />
      <Path d="M19.4 15a1.7 1.7 0 0 0 .34 1.88l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.7 1.7 0 0 0-2.88 1.2V21a2 2 0 1 1-4 0v-.09A1.7 1.7 0 0 0 7 19.4a1.7 1.7 0 0 0-1.88.34l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.7 1.7 0 0 0 2.6 14H2.5a2 2 0 1 1 0-4h.09A1.7 1.7 0 0 0 4.6 7a1.7 1.7 0 0 0-.34-1.88l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.7 1.7 0 0 0 9 2.6h.1a2 2 0 1 1 4 0v.09A1.7 1.7 0 0 0 17 4.6h.1" />
    </Svg>
  );
}

export function Rail() {
  const pathname = usePathname();
  const { server } = useActiveServer();
  const initials = (server?.name ?? 'PH').replace(/[^A-Za-z0-9]/g, '').slice(0, 2).toUpperCase();

  return (
    <View style={s.rail}>
      <View style={s.logo}>
        <Mark size={32} />
      </View>
      {items.map((it) => {
        const active = pathname.includes(it.key);
        return (
          <Pressable
            key={it.key}
            onPress={() => router.navigate(it.href)}
            style={[s.item, active && s.itemActive]}
          >
            <ItemIcon name={it.key} color={active ? colors.accent : colors.textMuted} />
            <Text style={[s.itemText, active && s.itemTextActive]}>{it.label}</Text>
          </Pressable>
        );
      })}
      <View style={{ flex: 1 }} />
      <View style={s.serverBox}>
        <Text style={s.serverBoxText}>{initials}</Text>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  rail: {
    width: 76,
    backgroundColor: colors.card,
    borderRightWidth: 1,
    borderRightColor: colors.border,
    alignItems: 'center',
    paddingVertical: 20,
    gap: 8,
  },
  logo: { marginBottom: 16 },
  item: {
    width: 52,
    height: 48,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
  },
  itemActive: { backgroundColor: colors.accentSoft },
  itemText: { fontSize: 9.5, fontFamily: fonts.sansMedium, color: colors.textMuted },
  itemTextActive: { fontFamily: fonts.sansSemiBold, color: colors.accent },
  serverBox: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: colors.ink,
    alignItems: 'center',
    justifyContent: 'center',
  },
  serverBoxText: { color: '#fff', fontSize: 12, fontFamily: fonts.monoSemiBold },
});
