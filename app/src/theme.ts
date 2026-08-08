// Design tokens from the Porthole brand sheet (design screen 2e).
export const colors = {
  accent: '#1B5E5A',
  accentSoft: '#E6F0EE',
  accentDark: '#7FB8B2',
  ink: '#0F1719',
  paper: '#F7F8FA',
  card: '#FFFFFF',
  border: '#E3E7EA',
  borderSoft: '#EDF1F2',
  fill: '#F1F4F5',
  text: '#0F1719',
  textLabel: '#33474C',
  textBody: '#4C5C61',
  textMuted: '#6B7A80',
  textFaint: '#8B989D',
  textGhost: '#9AA7AC',
  live: '#4ADE80',
  liveInk: '#0B2B18',
  person: '#1B5E5A',
  car: '#C2410C',
  animal: '#8B5CF6',
  danger: '#B4451F',
  dangerSoft: '#FBF1EC',
  tile: '#111416',
  videoText: '#C7D2D0',
  overlay: 'rgba(9,12,13,0.72)',
} as const;

export const labelColor = (label: string): string => {
  const l = label.toLowerCase();
  if (l === 'person') return colors.person;
  if (l === 'car' || l === 'truck' || l === 'motorcycle' || l === 'bicycle') return colors.car;
  if (l === 'cat' || l === 'dog' || l === 'fox' || l === 'bird' || l === 'animal') return colors.animal;
  return colors.textFaint;
};

export const fonts = {
  sans: 'Archivo_400Regular',
  sansMedium: 'Archivo_500Medium',
  sansSemiBold: 'Archivo_600SemiBold',
  sansBold: 'Archivo_700Bold',
  mono: 'JetBrainsMono_400Regular',
  monoMedium: 'JetBrainsMono_500Medium',
  monoSemiBold: 'JetBrainsMono_600SemiBold',
} as const;

export const radius = { sm: 7, md: 9, lg: 11, xl: 13 } as const;
