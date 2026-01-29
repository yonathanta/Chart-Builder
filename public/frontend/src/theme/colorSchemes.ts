export type ColorSchemeName =
  | "un-blue"
  | "sdg-categorical"
  | "africa-earth"
  | "diverging-teal-rose"
  | "diverging-blue-orange"
  | "grayscale-print";

export type ColorScheme = {
  name: ColorSchemeName;
  label: string;
  description: string;
  palette: string[];
  suitableFor: Array<"categorical" | "sequential" | "diverging" | "print">;
  colorBlindSafe: boolean;
};

// Palettes chosen for high contrast and common color-vision deficiencies.
export const colorSchemes: Record<ColorSchemeName, ColorScheme> = {
  "un-blue": {
    name: "un-blue",
    label: "UN Blue",
    description: "Core UN blue with tints for secondary accents; good for sequential emphasis.",
    palette: ["#009EDB", "#3FB3E6", "#74C5ED", "#A9D8F4", "#D4ECFA"],
    suitableFor: ["sequential", "categorical"],
    colorBlindSafe: true,
  },
  "sdg-categorical": {
    name: "sdg-categorical",
    label: "SDG Categorical",
    description: "Reduced SDG-inspired set (12 hues) tuned for accessibility and dashboard use.",
    palette: [
      "#E5243B", // SDG1 red
      "#DDA63A", // SDG2 gold
      "#4C9F38", // SDG3 green
      "#C5192D", // SDG4 deep red
      "#FF3A21", // SDG5 coral
      "#26BDE2", // SDG6 cyan
      "#FCC30B", // SDG7 yellow
      "#A21942", // SDG8 magenta
      "#FD6925", // SDG9 orange
      "#DD1367", // SDG10 pink
      "#19486A", // SDG14 navy
      "#3F7E44", // SDG15 forest
    ],
    suitableFor: ["categorical"],
    colorBlindSafe: true,
  },
  "africa-earth": {
    name: "africa-earth",
    label: "Africa Earth Tones",
    description: "Earth-inspired palette (soil, savanna, water) for regional statistical narratives.",
    palette: ["#5A3E1B", "#A06B2C", "#D9A441", "#6B8E3B", "#3E7A5E", "#2C6A8F"],
    suitableFor: ["categorical", "sequential"],
    colorBlindSafe: true,
  },
  "diverging-teal-rose": {
    name: "diverging-teal-rose",
    label: "Diverging Teal/Rose",
    description: "Balanced diverging palette for above/below comparisons and anomalies.",
    palette: ["#0F766E", "#14B8A6", "#99F6E4", "#FBCFE8", "#F472B6", "#BE185D"],
    suitableFor: ["diverging"],
    colorBlindSafe: true,
  },
  "diverging-blue-orange": {
    name: "diverging-blue-orange",
    label: "Diverging Blue/Orange",
    description: "Classic, high-contrast diverging palette with neutral midpoint.",
    palette: ["#0B4F6C", "#1F78B4", "#A6CEE3", "#F2F2F2", "#FDB863", "#E66101", "#B35806"],
    suitableFor: ["diverging"],
    colorBlindSafe: true,
  },
  "grayscale-print": {
    name: "grayscale-print",
    label: "Grayscale Print",
    description: "Monochrome set for print-safe outputs and high-contrast photocopies.",
    palette: ["#111111", "#2F2F2F", "#505050", "#7A7A7A", "#A3A3A3", "#C7C7C7"],
    suitableFor: ["print", "sequential", "categorical"],
    colorBlindSafe: true,
  },
};

export const colorSchemeNames = Object.keys(colorSchemes) as ColorSchemeName[];

export function getColorScheme(name: ColorSchemeName): ColorScheme {
  return colorSchemes[name];
}
