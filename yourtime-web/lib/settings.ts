export interface Category {
  name: string;
  color: string; // Hex color: #RRGGBB
  weight: number; // Peso nello score: numero decimale (es. -1.5, 0, 0.5, 1, 1.5)
  dailyLimitHours?: number; // Limite ore giornaliere (opzionale)
}

export interface ScoreConfig {
  targetWorkHours: number;
  minDailyHours: number;
  optimalDailyHours: number;
  formula: "balanced" | "productivity" | "flexible";
}

export interface SettingsData {
  categories: Category[];
  appMappings: Record<string, string>; // appName -> categoryName (normalized)
  domainMappings: Record<string, string>; // domain -> categoryName (normalized)
  appWeights: Record<string, number | null>; // appName -> peso specifico (null = usa peso categoria)
  domainWeights: Record<string, number | null>; // domain -> peso specifico (null = usa peso categoria)
  scoreConfig: ScoreConfig;
  meetingRelatedApps: string[]; // app names che sono funzionali ai meeting
  meetingRelatedDomains: string[]; // domini che sono funzionali ai meeting
}

export const DEFAULT_SETTINGS: SettingsData = {
  categories: [
    { name: "lavoro", color: "#dbeafe", weight: 1, dailyLimitHours: undefined },
    { name: "svago", color: "#dcfce7", weight: 0, dailyLimitHours: 1 },
    { name: "social", color: "#fce7f3", weight: -1, dailyLimitHours: 0.5 },
  ],
  appMappings: {},
  domainMappings: {},
  appWeights: {},
  domainWeights: {},
  scoreConfig: {
    targetWorkHours: 8,
    minDailyHours: 4,
    optimalDailyHours: 10,
    formula: "balanced",
  },
  meetingRelatedApps: [],
  meetingRelatedDomains: [],
};

export function normalizeCategoryName(name: string): string {
  return name.trim().toLowerCase();
}

export function generateRandomColor(): string {
  const hue = Math.floor(Math.random() * 360);
  const saturation = 70 + Math.floor(Math.random() * 20);
  const lightness = 85 + Math.floor(Math.random() * 10);

  const h = hue / 360;
  const s = saturation / 100;
  const l = lightness / 100;

  const hueToRgb = (p: number, q: number, t: number) => {
    if (t < 0) t += 1;
    if (t > 1) t -= 1;
    if (t < 1 / 6) return p + (q - p) * 6 * t;
    if (t < 1 / 2) return q;
    if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
    return p;
  };

  const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
  const p = 2 * l - q;

  const r = Math.round(hueToRgb(p, q, h + 1 / 3) * 255);
  const g = Math.round(hueToRgb(p, q, h) * 255);
  const b = Math.round(hueToRgb(p, q, h - 1 / 3) * 255);

  return `#${r.toString(16).padStart(2, "0")}${g.toString(16).padStart(2, "0")}${b.toString(16).padStart(2, "0")}`;
}
