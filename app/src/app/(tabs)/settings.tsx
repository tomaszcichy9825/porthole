import Constants from 'expo-constants';
import { router } from 'expo-router';
import { useState } from 'react';
import { Linking, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Card, Mono, Segmented } from '@/components/ui';
import { useServers } from '@/stores/servers';
import { colors, fonts, radius } from '@/theme';

// Design screen 2d: servers, defaults, sponsor card, about.
export default function Settings() {
  const { servers, activeId, reachability, setActive, removeServer, refreshReachability, gridQuality, fullscreenQuality, setQuality } =
    useServers();
  const [testing, setTesting] = useState<string | null>(null);

  const test = async (id: string) => {
    setTesting(id);
    await refreshReachability(id);
    setTesting(null);
  };

  return (
    <SafeAreaView style={s.safe} edges={['top']}>
      <ScrollView contentContainerStyle={s.scroll}>
        <View style={s.headerRow}>
          <Text style={s.title}>Settings</Text>
          <Pressable style={s.addBtn} onPress={() => router.push('/onboarding')}>
            <Text style={s.addBtnText}>+ Add server</Text>
          </Pressable>
        </View>

        <Text style={s.section}>Servers</Text>
        {servers.map((srv) => {
          const reach = reachability[srv.id];
          const active = srv.id === activeId;
          return (
            <Card key={srv.id} style={s.serverCard}>
              <View style={s.serverHead}>
                <View style={[s.dot, { backgroundColor: reach ? colors.live : '#C9D2D6' }]} />
                <Text style={s.serverName}>{srv.name}</Text>
                {active ? (
                  <View style={s.activeBadge}>
                    <Mono style={s.activeBadgeText}>
                      active{reach ? ` · ${reach.kind}` : ''}
                    </Mono>
                  </View>
                ) : null}
              </View>
              <View style={s.addr}>
                <Text style={s.addrLabel}>Local address</Text>
                <Mono style={s.addrValue}>{srv.localUrl}</Mono>
              </View>
              {srv.remoteUrl ? (
                <View style={s.addr}>
                  <Text style={s.addrLabel}>Remote address</Text>
                  <Mono style={s.addrValue}>{srv.remoteUrl}</Mono>
                </View>
              ) : null}
              {reach ? (
                <Mono style={s.reach}>✓ reachable via {reach.kind} · {reach.ms} ms</Mono>
              ) : null}
              <View style={s.serverActions}>
                <Pressable style={s.smallBtn} onPress={() => test(srv.id)}>
                  <Text style={s.smallBtnText}>
                    {testing === srv.id ? 'Testing…' : 'Test connection'}
                  </Text>
                </Pressable>
                {!active ? (
                  <Pressable style={s.smallBtn} onPress={() => setActive(srv.id)}>
                    <Text style={s.smallBtnText}>Make active</Text>
                  </Pressable>
                ) : null}
                <View style={{ flex: 1 }} />
                <Pressable style={s.removeBtn} onPress={() => removeServer(srv.id)}>
                  <Text style={s.removeText}>Remove</Text>
                </Pressable>
              </View>
            </Card>
          );
        })}

        <Text style={s.section}>Defaults for every server</Text>
        <Card>
          <View style={s.pref}>
            <Text style={s.prefLabel}>Live stream quality</Text>
            <Segmented
              options={['sub', 'main'] as const}
              value={gridQuality}
              onChange={(q) => setQuality('grid', q)}
              mono
            />
          </View>
          <View style={[s.pref, s.prefBorder]}>
            <Text style={s.prefLabel}>Fullscreen and recordings use</Text>
            <Segmented
              options={['sub', 'main'] as const}
              value={fullscreenQuality}
              onChange={(q) => setQuality('fullscreen', q)}
              mono
            />
          </View>
          <View style={[s.pref, s.prefBorder, { alignItems: 'flex-start', flexDirection: 'column', gap: 4 }]}>
            <Text style={s.prefLabel}>No telemetry</Text>
            <Text style={s.prefSub}>
              Nothing leaves this device. Crash reports are off until you turn them on.
            </Text>
          </View>
        </Card>

        <Card style={s.sponsor}>
          <Text style={s.sponsorTitle}>Porthole is free</Text>
          <Text style={s.sponsorSub}>Open source, no paywalls, no accounts.</Text>
          <Pressable
            style={s.sponsorBtn}
            onPress={() => Linking.openURL('https://github.com/sponsors/tomaszcichy9825')}
          >
            <Text style={s.sponsorBtnText}>Sponsor</Text>
          </Pressable>
        </Card>

        <Text style={s.about}>
          Porthole {Constants.expoConfig?.version ?? 'dev'} · Independent third-party client.
          Not affiliated with the Frigate project.
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.paper },
  scroll: { padding: 16, gap: 12, paddingBottom: 32, maxWidth: 720, width: '100%', alignSelf: 'center' },
  headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  title: { fontSize: 17, fontFamily: fonts.sansSemiBold, color: colors.ink },
  addBtn: {
    backgroundColor: colors.accent,
    borderRadius: radius.md,
    paddingHorizontal: 14,
    paddingVertical: 9,
  },
  addBtnText: { color: '#fff', fontSize: 13, fontFamily: fonts.sansSemiBold },
  section: {
    fontSize: 11,
    fontFamily: fonts.sansSemiBold,
    letterSpacing: 1.3,
    textTransform: 'uppercase',
    color: colors.textFaint,
    marginTop: 8,
  },
  serverCard: { padding: 16, gap: 10 },
  serverHead: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  dot: { width: 9, height: 9, borderRadius: 5 },
  serverName: { fontSize: 15, fontFamily: fonts.sansSemiBold, color: colors.ink },
  activeBadge: {
    backgroundColor: colors.accentSoft,
    borderRadius: 6,
    paddingHorizontal: 9,
    paddingVertical: 4,
  },
  activeBadgeText: { fontSize: 11, color: colors.accent },
  addr: { gap: 3 },
  addrLabel: { fontSize: 11.5, color: colors.textFaint, fontFamily: fonts.sans },
  addrValue: { fontSize: 13, color: colors.ink },
  reach: { fontSize: 11.5, color: colors.accent },
  serverActions: {
    flexDirection: 'row',
    gap: 8,
    borderTopWidth: 1,
    borderTopColor: colors.borderSoft,
    paddingTop: 12,
  },
  smallBtn: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.sm,
    paddingHorizontal: 13,
    paddingVertical: 8,
  },
  smallBtnText: { fontSize: 12.5, fontFamily: fonts.sansSemiBold, color: colors.textLabel },
  removeBtn: { paddingHorizontal: 13, paddingVertical: 8 },
  removeText: { fontSize: 12.5, fontFamily: fonts.sansSemiBold, color: colors.danger },
  pref: {
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  prefBorder: { borderTopWidth: 1, borderTopColor: colors.borderSoft },
  prefLabel: { fontSize: 13, fontFamily: fonts.sansMedium, color: colors.ink },
  prefSub: { fontSize: 11.5, color: colors.textFaint, fontFamily: fonts.sans, lineHeight: 16 },
  sponsor: { padding: 16, gap: 8 },
  sponsorTitle: { fontSize: 12.5, fontFamily: fonts.sansSemiBold, color: colors.ink },
  sponsorSub: { fontSize: 11.5, color: colors.textFaint, fontFamily: fonts.sans },
  sponsorBtn: {
    height: 32,
    borderRadius: 8,
    backgroundColor: colors.fill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sponsorBtnText: { fontSize: 12, fontFamily: fonts.sansSemiBold, color: colors.accent },
  about: {
    fontSize: 11.5,
    color: colors.textGhost,
    textAlign: 'center',
    fontFamily: fonts.sans,
    marginTop: 8,
    lineHeight: 16,
  },
});
