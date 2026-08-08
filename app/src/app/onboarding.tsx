import { router } from 'expo-router';
import { useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Mark } from '@/components/Mark';
import { Card, Mono } from '@/components/ui';
import { createClient } from '@/lib/frigate';
import { useServers } from '@/stores/servers';
import { colors, fonts, radius } from '@/theme';

type TestResult = { version: string; cameras: string[] } | { error: string } | null;

// Design screen 2a: point Porthole at your Frigate.
export default function Onboarding() {
  const addServer = useServers((s) => s.addServer);
  const refresh = useServers((s) => s.refreshReachability);

  const [localUrl, setLocalUrl] = useState('http://');
  const [remoteUrl, setRemoteUrl] = useState('');
  const [name, setName] = useState('Home');
  const [testing, setTesting] = useState(false);
  const [result, setResult] = useState<TestResult>(null);

  const test = async () => {
    setTesting(true);
    setResult(null);
    try {
      const fg = createClient(localUrl.trim());
      const version = await fg.getVersion();
      const cfg = await fg.getConfig();
      setResult({ version, cameras: Object.keys(cfg.cameras) });
    } catch (e) {
      setResult({ error: e instanceof Error ? e.message : 'Connection failed' });
    } finally {
      setTesting(false);
    }
  };

  const save = async () => {
    const id = addServer({
      name: name.trim() || 'Frigate',
      localUrl: localUrl.trim().replace(/\/$/, ''),
      remoteUrl: remoteUrl.trim() ? remoteUrl.trim().replace(/\/$/, '') : undefined,
    });
    refresh(id);
    router.replace('/(tabs)/cameras');
  };

  const ok = result && 'version' in result;

  return (
    <SafeAreaView style={s.safe}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={{ flex: 1 }}
      >
        <ScrollView contentContainerStyle={s.scroll} keyboardShouldPersistTaps="handled">
          <View style={s.header}>
            <Mark size={44} />
            <Text style={s.title}>Point Porthole at your Frigate</Text>
            <Text style={s.sub}>
              Video goes straight from your server to this device. Nothing passes through a cloud,
              and no account is needed.
            </Text>
          </View>

          <Card style={s.form}>
            <View style={s.field}>
              <Text style={s.label}>Local address</Text>
              <TextInput
                style={s.input}
                value={localUrl}
                onChangeText={setLocalUrl}
                autoCapitalize="none"
                autoCorrect={false}
                keyboardType="url"
                placeholder="http://192.168.0.3:5000"
                placeholderTextColor={colors.textGhost}
              />
            </View>
            <View style={s.field}>
              <View style={s.labelRow}>
                <Text style={s.label}>Remote address</Text>
                <Text style={s.labelHint}>optional · Tailscale, WireGuard, proxy</Text>
              </View>
              <TextInput
                style={s.input}
                value={remoteUrl}
                onChangeText={setRemoteUrl}
                autoCapitalize="none"
                autoCorrect={false}
                keyboardType="url"
                placeholder="http://100.84.12.7:5000"
                placeholderTextColor={colors.textGhost}
              />
            </View>
            <View style={s.field}>
              <Text style={s.label}>Name</Text>
              <TextInput
                style={s.input}
                value={name}
                onChangeText={setName}
                placeholder="Home"
                placeholderTextColor={colors.textGhost}
              />
            </View>

            {result ? (
              <View style={s.result}>
                {ok ? (
                  <>
                    <Text style={s.resultOk}>
                      ✓ Connected · Frigate {(result as { version: string }).version} ·{' '}
                      {(result as { cameras: string[] }).cameras.length} cameras
                    </Text>
                    <View style={s.camChips}>
                      {(result as { cameras: string[] }).cameras.map((c) => (
                        <View key={c} style={s.camChip}>
                          <Mono style={s.camChipText}>{c}</Mono>
                        </View>
                      ))}
                    </View>
                  </>
                ) : (
                  <Text style={s.resultErr}>{(result as { error: string }).error}</Text>
                )}
              </View>
            ) : null}
          </Card>

          <View style={s.buttons}>
            <Pressable
              style={[s.primary, !ok && s.primaryDisabled]}
              disabled={!ok}
              onPress={save}
            >
              <Text style={s.primaryText}>Open Porthole</Text>
            </Pressable>
            <Pressable style={s.secondary} onPress={test} disabled={testing}>
              <Text style={s.secondaryText}>{testing ? 'Testing…' : result ? 'Test again' : 'Test connection'}</Text>
            </Pressable>
          </View>

          <Text style={s.disclaimer}>
            Independent third-party client. Not affiliated with the Frigate project.
          </Text>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.paper },
  scroll: { padding: 24, gap: 22, flexGrow: 1, justifyContent: 'center' },
  header: { gap: 12, alignItems: 'flex-start' },
  title: { fontSize: 28, fontFamily: fonts.sansBold, color: colors.ink, letterSpacing: -0.8 },
  sub: { fontSize: 15, color: colors.textMuted, lineHeight: 22, fontFamily: fonts.sans },
  form: { padding: 20, gap: 16 },
  field: { gap: 7 },
  labelRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  label: { fontSize: 12.5, fontFamily: fonts.sansSemiBold, color: colors.textLabel },
  labelHint: { fontSize: 11.5, color: colors.textFaint, fontFamily: fonts.sans },
  input: {
    height: 44,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: 13,
    fontFamily: fonts.mono,
    fontSize: 13.5,
    color: colors.ink,
    backgroundColor: colors.card,
  },
  result: { borderTopWidth: 1, borderTopColor: colors.borderSoft, paddingTop: 14, gap: 10 },
  resultOk: { fontSize: 13, fontFamily: fonts.sansSemiBold, color: colors.accent },
  resultErr: { fontSize: 13, fontFamily: fonts.sans, color: colors.danger },
  camChips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  camChip: {
    paddingHorizontal: 11,
    paddingVertical: 6,
    borderRadius: radius.sm,
    backgroundColor: colors.fill,
  },
  camChipText: { fontSize: 11.5, color: colors.textBody },
  buttons: { flexDirection: 'row', gap: 10 },
  primary: {
    flex: 1,
    height: 46,
    borderRadius: radius.lg,
    backgroundColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryDisabled: { opacity: 0.4 },
  primaryText: { color: '#fff', fontSize: 14, fontFamily: fonts.sansSemiBold },
  secondary: {
    height: 46,
    paddingHorizontal: 18,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
    alignItems: 'center',
    justifyContent: 'center',
  },
  secondaryText: { fontSize: 14, fontFamily: fonts.sansSemiBold, color: colors.textLabel },
  disclaimer: { fontSize: 12, color: colors.textGhost, textAlign: 'center', fontFamily: fonts.sans },
});
