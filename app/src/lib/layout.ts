import { useWindowDimensions } from 'react-native';

// The design's desktop console kicks in at wide widths (Mac "Designed for
// iPad", iPad landscape). Narrow stays on the phone tab layout.
export const WIDE_BREAKPOINT = 900;

export const useWide = () => useWindowDimensions().width >= WIDE_BREAKPOINT;
