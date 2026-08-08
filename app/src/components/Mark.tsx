import Svg, { Circle, Path } from 'react-native-svg';

import { colors } from '@/theme';

// The Porthole mark: a ring, a lit half, an aperture at the centre.
export function Mark({
  size = 32,
  ring = colors.accent,
  half = colors.accent,
  aperture = colors.paper,
}: {
  size?: number;
  ring?: string;
  half?: string;
  aperture?: string;
}) {
  return (
    <Svg width={size} height={size} viewBox="0 0 32 32" fill="none">
      <Circle cx={16} cy={16} r={13} stroke={ring} strokeWidth={2.5} />
      <Path d="M16 7a9 9 0 0 1 0 18z" fill={half} />
      <Circle cx={16} cy={16} r={3.2} fill={aperture} />
    </Svg>
  );
}
