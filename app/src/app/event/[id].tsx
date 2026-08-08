import { router, useLocalSearchParams } from 'expo-router';
import { Pressable, StyleSheet, Text } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { EventDetail } from '@/components/EventDetail';
import { colors, fonts } from '@/theme';

export default function EventScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  if (!id) return null;

  return (
    <SafeAreaView style={s.safe}>
      <Pressable onPress={() => router.back()} style={s.back}>
        <Text style={s.backText}>‹ Events</Text>
      </Pressable>
      <EventDetail id={id} onDeleted={() => router.back()} />
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.paper },
  back: { paddingHorizontal: 16, paddingVertical: 8 },
  backText: { fontSize: 13, fontFamily: fonts.sansSemiBold, color: colors.textLabel },
});
