import { Tabs } from 'expo-router';
import Svg, { Circle, Path, Rect } from 'react-native-svg';

import { colors, fonts } from '@/theme';

// The desktop rail becomes bottom tabs on mobile: Cameras, Events, Settings.
const GridIcon = ({ color }: { color: import('react-native').ColorValue }) => (
  <Svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={1.8}>
    <Rect x={3} y={4} width={8} height={7} rx={1.5} />
    <Rect x={13} y={4} width={8} height={7} rx={1.5} />
    <Rect x={3} y={13} width={8} height={7} rx={1.5} />
    <Rect x={13} y={13} width={8} height={7} rx={1.5} />
  </Svg>
);

const ListIcon = ({ color }: { color: import('react-native').ColorValue }) => (
  <Svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={1.8}>
    <Path d="M4 6h16M4 12h16M4 18h10" />
  </Svg>
);

const GearIcon = ({ color }: { color: import('react-native').ColorValue }) => (
  <Svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={1.8}>
    <Circle cx={12} cy={12} r={3} />
    <Path d="M19.4 15a1.7 1.7 0 0 0 .34 1.88l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.7 1.7 0 0 0-2.88 1.2V21a2 2 0 1 1-4 0v-.09A1.7 1.7 0 0 0 7 19.4a1.7 1.7 0 0 0-1.88.34l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.7 1.7 0 0 0 2.6 14H2.5a2 2 0 1 1 0-4h.09A1.7 1.7 0 0 0 4.6 7a1.7 1.7 0 0 0-.34-1.88l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.7 1.7 0 0 0 9 2.6h.1a2 2 0 1 1 4 0v.09A1.7 1.7 0 0 0 17 4.6h.1" />
  </Svg>
);

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.accent,
        tabBarInactiveTintColor: colors.textMuted,
        tabBarStyle: { backgroundColor: colors.card, borderTopColor: colors.border },
        tabBarLabelStyle: { fontFamily: fonts.sansSemiBold, fontSize: 10 },
      }}
    >
      <Tabs.Screen
        name="cameras"
        options={{ title: 'Cameras', tabBarIcon: ({ color }) => <GridIcon color={color} /> }}
      />
      <Tabs.Screen
        name="events"
        options={{ title: 'Events', tabBarIcon: ({ color }) => <ListIcon color={color} /> }}
      />
      <Tabs.Screen
        name="settings"
        options={{ title: 'Settings', tabBarIcon: ({ color }) => <GearIcon color={color} /> }}
      />
    </Tabs>
  );
}
