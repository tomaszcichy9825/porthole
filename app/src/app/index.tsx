import { Redirect } from 'expo-router';

import { useServers } from '@/stores/servers';

export default function Index() {
  const servers = useServers((s) => s.servers);
  return servers.length === 0 ? <Redirect href="/onboarding" /> : <Redirect href="/(tabs)/cameras" />;
}
