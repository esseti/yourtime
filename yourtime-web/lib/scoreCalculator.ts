import { ProcessedEvent } from "./csvProcessor";
import { SettingsData } from "./settings";

export interface ScoreBreakdown {
  total: number;
  workScore: number;
  volumeScore: number;
  limitsScore: number;
  details: {
    workHours: number;
    positiveWeightedHours: number;
    negativeWeightedHours: number;
    totalHours: number;
    categoriesOverLimit: Array<{ name: string; hours: number; limit: number }>;
  };
}

function getCategoryForEvent(
  event: ProcessedEvent,
  settings: SettingsData,
): { name: string; weight: number; dailyLimitHours?: number } | null {
  if (event.domain) {
    const categoryName = settings.domainMappings[event.domain];
    if (categoryName) {
      const category = settings.categories.find((c) => c.name === categoryName);
      if (category) {
        const domainWeight = settings.domainWeights[event.domain];
        const effectiveWeight =
          domainWeight !== null && domainWeight !== undefined
            ? domainWeight
            : category.weight;
        return {
          name: category.name,
          weight: effectiveWeight,
          dailyLimitHours: category.dailyLimitHours,
        };
      }
    }
  }

  const categoryName = settings.appMappings[event.appName];
  if (categoryName) {
    const category = settings.categories.find((c) => c.name === categoryName);
    if (category) {
      const appWeight = settings.appWeights[event.appName];
      const effectiveWeight =
        appWeight !== null && appWeight !== undefined
          ? appWeight
          : category.weight;
      return {
        name: category.name,
        weight: effectiveWeight,
        dailyLimitHours: category.dailyLimitHours,
      };
    }
  }

  return null;
}

function calculateUnifiedScore(
  events: ProcessedEvent[],
  settings: SettingsData,
): ScoreBreakdown {
  const totalTimeSeconds = events.reduce((acc, ev) => acc + ev.duration, 0);
  const totalHours = totalTimeSeconds / 3600;

  const offTimeSeconds = events
    .filter((ev) => {
      const cat = getCategoryForEvent(ev, settings);
      return cat?.name.toLowerCase() === "off";
    })
    .reduce((acc, ev) => acc + ev.duration, 0);

  const cleanTimeSeconds = totalTimeSeconds - offTimeSeconds;
  const cleanHours = cleanTimeSeconds / 3600;

  const positiveWeightedHours = events
    .filter((ev) => {
      const cat = getCategoryForEvent(ev, settings);
      return cat && cat.name.toLowerCase() !== "off" && cat.weight > 0;
    })
    .reduce((acc, ev) => {
      const cat = getCategoryForEvent(ev, settings);
      return acc + (ev.duration / 3600) * (cat?.weight || 0);
    }, 0);

  const negativeWeightedHours = events
    .filter((ev) => {
      const cat = getCategoryForEvent(ev, settings);
      return cat && cat.name.toLowerCase() !== "off" && cat.weight < 0;
    })
    .reduce((acc, ev) => {
      const cat = getCategoryForEvent(ev, settings);
      return acc + (ev.duration / 3600) * Math.abs(cat?.weight || 0);
    }, 0);

  const netHours = positiveWeightedHours - negativeWeightedHours;

  let netScore = 0;
  const targetWork = settings.scoreConfig.targetWorkHours;
  const ratio = netHours / targetWork;

  if (ratio >= 1.0) {
    netScore = 10;
  } else if (ratio >= 0.75) {
    netScore = 7 + ((ratio - 0.75) / 0.25) * 3;
  } else if (ratio >= 0.5) {
    netScore = 4 + ((ratio - 0.5) / 0.25) * 3;
  } else {
    netScore = (ratio / 0.5) * 4;
  }

  let volumeScore = 0;
  const minHours = settings.scoreConfig.minDailyHours;
  const optimalHours = settings.scoreConfig.optimalDailyHours;

  if (cleanHours >= optimalHours) {
    volumeScore = 10;
  } else if (cleanHours >= minHours) {
    volumeScore = 5 + ((cleanHours - minHours) / (optimalHours - minHours)) * 5;
  } else {
    volumeScore = (cleanHours / minHours) * 5;
  }

  const total = Math.min(10, Math.max(0, netScore * 0.75 + volumeScore * 0.25));

  return {
    total: Math.round(total * 10) / 10,
    workScore: Math.round(netScore * 10) / 10,
    volumeScore: Math.round(volumeScore * 10) / 10,
    limitsScore: 10,
    details: {
      workHours: Math.round(netHours * 10) / 10,
      positiveWeightedHours: Math.round(positiveWeightedHours * 10) / 10,
      negativeWeightedHours: Math.round(negativeWeightedHours * 10) / 10,
      totalHours: Math.round(cleanHours * 10) / 10,
      categoriesOverLimit: [],
    },
  };
}

export function calculateDayScore(
  events: ProcessedEvent[],
  settings: SettingsData,
): number {
  const breakdown = getScoreBreakdown(events, settings);
  return breakdown.total;
}

export function getScoreBreakdown(
  events: ProcessedEvent[],
  settings: SettingsData,
): ScoreBreakdown {
  if (events.length === 0) {
    return {
      total: 0,
      workScore: 0,
      volumeScore: 0,
      limitsScore: 10,
      details: {
        workHours: 0,
        positiveWeightedHours: 0,
        negativeWeightedHours: 0,
        totalHours: 0,
        categoriesOverLimit: [],
      },
    };
  }

  return calculateUnifiedScore(events, settings);
}

export function getScoreColor(score: number): string {
  if (score >= 8) return "#22c55e";
  if (score >= 7) return "#84cc16";
  if (score >= 5) return "#eab308";
  if (score >= 3) return "#f97316";
  return "#ef4444";
}

export function getScoreLabel(score: number): string {
  if (score >= 9) return "Eccellente";
  if (score >= 8) return "Ottimo";
  if (score >= 7) return "Buono";
  if (score >= 6) return "Discreto";
  if (score >= 5) return "Sufficiente";
  if (score >= 4) return "Mediocre";
  if (score >= 3) return "Scarso";
  return "Insufficiente";
}
