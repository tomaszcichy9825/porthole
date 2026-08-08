import { router } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { FlatList, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { CameraTile } from '@/components/CameraTile';
import { Chip, Mono, Segmented } from '@/components/ui';
import { useWide } from '@/lib/layout';
import { useCameras, useFrigate } from '@/lib/queries';
import { useActiveServer, useServers } from '@/stores/servers';
import { colors, fonts } from '@/theme';

// Design screen 2b: live grid with groups, column switcher, status.
export default function Cameras() {
  const fg = useFrigate();
  const { server, reach } = useActiveServer();
  const refreshReachability = useServers((s) => s.refreshReachability);
  const { cameras, data: config, isLoading, refetch, isRefetching } = useCameras();

  const wide = useWide();
  const [columns, setColumns] = useState<'1' | '2' | '3'>(wide ? '3' : '2');
  const [group, setGroup] = useState<string>('All');

  const serverId = server?.id;
  useEffect(() => {
    if (serverId) refreshReachability(serverId);
  }, [serverId, refreshReachability]);

  const groups = useMemo(() => {
    const g = config?.camera_groups ?? {};
    return Object.entries(g)
      .sort((a, b) => (a[1].order ?? 0) - (b[1].order ?? 0))
      .map(([name, def]) => ({ name, cameras: def.cameras }));
  }, [config]);

  const visible = useMemo(() => {
    if (group === 'All') return cameras;
    const def = groups.find((g) => g.name === group);
    return def ? cameras.filter((c) => def.cameras.includes(c)) : cameras;
  }, [cameras, group, groups]);

  if (!fg || !server) return null;

  return (
    <SafeAreaView style={s.safe} edges={['top']}>
      <View style={s.header}>
        <Text style={s.title}>{server.name}</Text>
        <View style={s.statusPill}>
          <View style={[s.dot, { backgroundColor: reach ? colors.live : colors.textGhost }]} />
          <Mono style={s.statusText}>
            {reach ? `${reach.kind} · ${reach.ms} ms` : 'checking…'}
          </Mono>
        </View>
        <View style={{ flex: 1 }} />
        <Segmented
          options={wide ? (['1', '2', '3'] as const) : (['1', '2'] as const)}
          value={columns}
          onChange={setColumns}
          mono
        />
      </View>

      {groups.length > 0 ? (
        <View style={s.groupRow}>
          <FlatList
            horizontal
            showsHorizontalScrollIndicator={false}
            data={['All', ...groups.map((g) => g.name)]}
            keyExtractor={(g) => g}
            contentContainerStyle={{ gap: 6, paddingHorizontal: 16 }}
            renderItem={({ item }) => {
              const def = groups.find((g) => g.name === item);
              const count = item === 'All' ? cameras.length : (def?.cameras.length ?? 0);
              return (
                <Chip
                  label={`${item} ${count}`}
                  active={group === item}
                  onPress={() => setGroup(item)}
                />
              );
            }}
          />
        </View>
      ) : null}

      <FlatList
        key={columns}
        data={visible}
        keyExtractor={(c) => c}
        numColumns={Number(columns)}
        columnWrapperStyle={columns !== '1' ? { gap: 10 } : undefined}
        contentContainerStyle={s.grid}
        refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} />}
        ListEmptyComponent={
          <Text style={s.empty}>{isLoading ? 'Loading cameras…' : 'No cameras found.'}</Text>
        }
        renderItem={({ item }) => {
          const detect = config?.cameras[item]?.detect;
          return (
            <CameraTile
              name={item}
              snapshotUrl={fg.snapshotUrl(item, 480)}
              headers={fg.authHeaders}
              resolution={detect ? `${detect.width}×${detect.height}` : undefined}
              onPress={() => router.push({ pathname: '/camera/[name]', params: { name: item } })}
            />
          );
        }}
      />
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.paper },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: colors.card,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  title: { fontSize: 17, fontFamily: fonts.sansSemiBold, color: colors.ink, letterSpacing: -0.2 },
  statusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    backgroundColor: colors.fill,
    borderRadius: 8,
    paddingHorizontal: 11,
    paddingVertical: 7,
  },
  dot: { width: 6, height: 6, borderRadius: 3 },
  statusText: { fontSize: 12, color: colors.textMuted },
  groupRow: {
    paddingVertical: 9,
    backgroundColor: colors.card,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    marginBottom: 10,
  },
  grid: { paddingHorizontal: 16, paddingBottom: 24, gap: 10 },
  empty: {
    textAlign: 'center',
    marginTop: 48,
    color: colors.textFaint,
    fontFamily: fonts.sans,
    fontSize: 14,
  },
});
