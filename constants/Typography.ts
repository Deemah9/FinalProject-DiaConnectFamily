import { TextStyle } from "react-native";

const fontFamily = undefined; // خليها undefined لحد ما تضيف خط مخصص (Expo Fonts)

export const Typography: Record<string, TextStyle> = {
  h1: { fontSize: 32, lineHeight: 40, fontWeight: "700", fontFamily },
  h2: { fontSize: 24, lineHeight: 32, fontWeight: "700", fontFamily },
  h3: { fontSize: 20, lineHeight: 28, fontWeight: "600", fontFamily },

  body: { fontSize: 16, lineHeight: 24, fontWeight: "400", fontFamily },
  bodyMedium: { fontSize: 16, lineHeight: 24, fontWeight: "500", fontFamily },

  label: { fontSize: 14, lineHeight: 20, fontWeight: "600", fontFamily },
  caption: { fontSize: 12, lineHeight: 16, fontWeight: "400", fontFamily },
};

export default Typography;
