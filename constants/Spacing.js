// Base unit (كل النظام مبني عليه)
const BASE = 8;

export const Spacing = {
  // Scale الأساسي
  xxs: BASE * 0.5, // 4
  xs: BASE * 1,    // 8
  sm: BASE * 1.5,  // 12
  md: BASE * 2,    // 16
  lg: BASE * 3,    // 24
  xl: BASE * 4,    // 32
  xxl: BASE * 5,   // 40

  // Aliases استخدام شائع
  screenPadding: BASE * 2,   // 16
  cardPadding: BASE * 2,     // 16
  sectionGap: BASE * 3,      // 24
  itemGap: BASE * 1.5,       // 12
};
