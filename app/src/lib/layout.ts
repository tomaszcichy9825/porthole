import { useWindowDimensions } from 'react-native';

// The design's desktop console kicks in at wide widths (Mac "Designed for
// iPad", iPad landscape). Narrow stays on the phone tab layout.
export const WIDE_BREAKPOINT = 900;

// A phone held sideways is wide but far too short for the rail console.
export const useWide = () => {
  const { width, height } = useWindowDimensions();
  return width >= WIDE_BREAKPOINT && height >= 500;
};
