import React from "react";
import { format } from "date-fns";
import { ProcessedEvent } from "@/lib/csvProcessor";
import { SettingsData } from "@/lib/settings";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  getScoreBreakdown,
  getScoreColor,
  getScoreLabel,
} from "@/lib/scoreCalculator";

interface DayStatsProps {
  events: ProcessedEvent[];
  settings: SettingsData;
}

interface CategoryStats {
  name: string;
  duration: number;
  percentage: number;
  color: string;
}

interface AppStats {
  name: string;
  duration: number;
  percentage: number;
  color: string;
}

export function DayStats({ events, settings }: DayStatsProps) {
  const [showScoreDetails, setShowScoreDetails] = React.useState(false);

  const getCategoryForEvent = (
    event: ProcessedEvent,
  ): { name: string; color: string } | null => {
    if (event.domain) {
      const categoryName = settings.domainMappings[event.domain];
      if (categoryName) {
        const category = settings.categories.find(
          (c) => c.name === categoryName,
        );
        if (category) {
          return { name: category.name, color: category.color };
        }
      }
    }

    const categoryName = settings.appMappings[event.appName];
    if (categoryName) {
      const category = settings.categories.find((c) => c.name === categoryName);
      if (category) {
        return { name: category.name, color: category.color };
      }
    }

    return null;
  };

  const getEffectiveWeight = (event: ProcessedEvent): number => {
    if (event.domain) {
      const domainWeight = settings.domainWeights[event.domain];
      if (domainWeight !== null && domainWeight !== undefined) {
        return domainWeight;
      }
      const categoryName = settings.domainMappings[event.domain];
      if (categoryName) {
        const category = settings.categories.find(
          (c) => c.name === categoryName,
        );
        if (category) return category.weight;
      }
    }

    const appWeight = settings.appWeights[event.appName];
    if (appWeight !== null && appWeight !== undefined) {
      return appWeight;
    }

    const categoryName = settings.appMappings[event.appName];
    if (categoryName) {
      const category = settings.categories.find((c) => c.name === categoryName);
      if (category) return category.weight;
    }

    return 0;
  };

  const totalTimeSeconds = events.reduce((acc, ev) => acc + ev.duration, 0);

  const offTimeSeconds = events
    .filter((ev) => {
      const cat = getCategoryForEvent(ev);
      return cat?.name.toLowerCase() === "off";
    })
    .reduce((acc, ev) => acc + ev.duration, 0);

  const cleanTimeSeconds = totalTimeSeconds - offTimeSeconds;
  const offTimePercentage =
    totalTimeSeconds > 0 ? (offTimeSeconds / totalTimeSeconds) * 100 : 0;

  const firstMoment = events.length > 0 ? events[0].startTime : null;
  const lastMoment =
    events.length > 0 ? events[events.length - 1].endTime : null;

  const categoryMap = new Map<string, { duration: number; color: string }>();

  events.forEach((ev) => {
    const cat = getCategoryForEvent(ev);
    if (cat && cat.name.toLowerCase() !== "off") {
      const existing = categoryMap.get(cat.name);
      if (existing) {
        existing.duration += ev.duration;
      } else {
        categoryMap.set(cat.name, { duration: ev.duration, color: cat.color });
      }
    }
  });

  const categoryStats: CategoryStats[] = Array.from(categoryMap.entries())
    .map(([name, { duration, color }]) => ({
      name,
      duration,
      percentage:
        cleanTimeSeconds > 0 ? (duration / cleanTimeSeconds) * 100 : 0,
      color,
    }))
    .sort((a, b) => b.duration - a.duration);

  const appMap = new Map<
    string,
    {
      duration: number;
      categoryDurations: Map<string, { duration: number; color: string }>;
    }
  >();

  events.forEach((ev) => {
    const cat = getCategoryForEvent(ev);
    if (cat?.name.toLowerCase() === "off") {
      return;
    }

    const appName = ev.appName?.trim();
    const websiteName = ev.domain?.trim().replace(/^www\./, "");
    const usageName = websiteName || appName;

    if (!usageName) {
      return;
    }

    const categoryKey = cat ? cat.name : "uncategorized";
    const categoryColor = cat ? cat.color : "#9ca3af";

    const existing = appMap.get(usageName);
    if (existing) {
      existing.duration += ev.duration;
      const existingCategory = existing.categoryDurations.get(categoryKey);
      if (existingCategory) {
        existingCategory.duration += ev.duration;
      } else {
        existing.categoryDurations.set(categoryKey, {
          duration: ev.duration,
          color: categoryColor,
        });
      }
      return;
    }

    appMap.set(usageName, {
      duration: ev.duration,
      categoryDurations: new Map([
        [categoryKey, { duration: ev.duration, color: categoryColor }],
      ]),
    });
  });

  const appStats: AppStats[] = Array.from(appMap.entries())
    .map(([name, stats]) => {
      const dominantCategory = Array.from(
        stats.categoryDurations.values(),
      ).sort((a, b) => b.duration - a.duration)[0];

      return {
        name,
        duration: stats.duration,
        percentage:
          cleanTimeSeconds > 0 ? (stats.duration / cleanTimeSeconds) * 100 : 0,
        color: dominantCategory?.color || "#9ca3af",
      };
    })
    .sort((a, b) => b.duration - a.duration);

  const formatTime = (seconds: number): string => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.round((seconds % 3600) / 60);
    return `${hours}h ${minutes}m`;
  };

  const formatSecondsAsHHMM = (seconds: number): string => {
    const totalMinutes = Math.round(seconds / 60);
    const hoursPart = Math.floor(totalMinutes / 60);
    const minutesPart = totalMinutes % 60;
    return `${hoursPart.toString().padStart(2, "0")}:${minutesPart
      .toString()
      .padStart(2, "0")}`;
  };

  const formatMinutesAsHoursMinutes = (minutes: number): string => {
    const isNegative = minutes < 0;
    const absMinutes = Math.abs(minutes);
    const hoursPart = Math.floor(absMinutes / 60);
    const minutesPart = Math.floor(absMinutes % 60);
    const sign = isNegative ? "-" : "";
    return `${sign}${hoursPart}:${minutesPart.toString().padStart(2, "0")}`;
  };

  const formatHoursAsHoursMinutes = (hours: number): string => {
    const totalMinutes = Math.round(hours * 60);
    return formatMinutesAsHoursMinutes(totalMinutes);
  };

  const truncateLabel = (label: string, maxLength = 20): string => {
    if (label.length <= maxLength) {
      return label;
    }
    return `${label.slice(0, maxLength - 1)}…`;
  };

  const chartData = categoryStats.map((stat) => ({
    name: stat.name,
    durationMinutes: Math.round(stat.duration / 60),
    percentuale: stat.percentage.toFixed(1),
    color: stat.color,
  }));

  const topAppStats = appStats.slice(0, 7);
  const appChartData = topAppStats.map((stat) => ({
    name: stat.name,
    shortName: truncateLabel(stat.name),
    durationMinutes: Math.round(stat.duration / 60),
    percentage: stat.percentage.toFixed(1),
    color: stat.color,
  }));

  const scoreBreakdown = getScoreBreakdown(events, settings);
  const scoreColor = getScoreColor(scoreBreakdown.total);
  const scoreLabel = getScoreLabel(scoreBreakdown.total);

  const actualWorkHours = React.useMemo(() => {
    return events
      .filter((ev) => {
        const cat = getCategoryForEvent(ev);
        if (!cat || cat.name.toLowerCase() === "off") return false;
        const weight = getEffectiveWeight(ev);
        return weight > 0;
      })
      .reduce((acc, ev) => acc + ev.duration / 3600, 0);
  }, [events, settings]);

  const weightDetails = React.useMemo(() => {
    const details = new Map<
      string,
      { hours: number; weight: number; weightedHours: number; category: string }
    >();

    events.forEach((ev) => {
      const cat = getCategoryForEvent(ev);
      if (cat && cat.name.toLowerCase() !== "off") {
        const weight = getEffectiveWeight(ev);
        const hours = ev.duration / 3600;
        const weightedHours = hours * weight;

        const key = ev.domain || ev.appName;
        const existing = details.get(key);
        if (existing) {
          existing.hours += hours;
          existing.weightedHours += weightedHours;
        } else {
          details.set(key, {
            hours,
            weight,
            weightedHours,
            category: cat.name,
          });
        }
      }
    });

    return Array.from(details.entries())
      .map(([name, data]) => ({ name, ...data }))
      .sort((a, b) => b.hours - a.hours);
  }, [events, settings]);

  const categoryWeightedAverages = React.useMemo(() => {
    const categoryData = new Map<
      string,
      { totalHours: number; totalWeightedHours: number }
    >();

    weightDetails.forEach((detail) => {
      const existing = categoryData.get(detail.category);
      if (existing) {
        existing.totalHours += detail.hours;
        existing.totalWeightedHours += detail.weightedHours;
      } else {
        categoryData.set(detail.category, {
          totalHours: detail.hours,
          totalWeightedHours: detail.weightedHours,
        });
      }
    });

    return Array.from(categoryData.entries())
      .map(([category, data]) => ({
        category,
        totalHours: data.totalHours,
        weightedAverage:
          data.totalHours > 0 ? data.totalWeightedHours / data.totalHours : 0,
      }))
      .sort((a, b) => b.totalHours - a.totalHours);
  }, [weightDetails]);

  return (
    <section className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
      <h2 className="text-xl font-semibold text-gray-800 mb-4">
        Statistiche Giornata
      </h2>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="flex flex-col gap-6">
          <div className="flex flex-col gap-4">
            <div className="flex flex-col">
              <p className="text-sm text-gray-500">Tempo Attivo</p>
              <p className="text-4xl font-bold text-gray-900">
                {formatTime(cleanTimeSeconds)}
              </p>
              <p className="text-sm text-gray-400 mt-1">
                (Totale: {formatTime(totalTimeSeconds)} • Off:{" "}
                {formatSecondsAsHHMM(offTimeSeconds)} (
                {offTimePercentage.toFixed(1)}
                %))
              </p>
            </div>

            {firstMoment && lastMoment && (
              <div className="flex flex-col gap-2 border-t border-gray-100 pt-4">
                <div className="flex items-center gap-4 text-sm text-gray-600">
                  <div>
                    <span className="font-semibold">Primo:</span>{" "}
                    <span className="font-mono">
                      {format(new Date(firstMoment), "HH:mm:ss")}
                    </span>
                  </div>
                  <div className="text-gray-300">|</div>
                  <div>
                    <span className="font-semibold">Ultimo:</span>{" "}
                    <span className="font-mono">
                      {format(new Date(lastMoment), "HH:mm:ss")}
                    </span>
                  </div>
                </div>
                <div className="text-xs text-gray-500">
                  Timezone: {Intl.DateTimeFormat().resolvedOptions().timeZone}
                </div>
              </div>
            )}
          </div>

          {events.length > 0 && (
            <div
              className="p-4 rounded-lg border-2 relative"
              style={{
                borderColor: scoreColor,
                backgroundColor: `${scoreColor}10`,
              }}
            >
              <button
                onClick={() => setShowScoreDetails(!showScoreDetails)}
                className="absolute top-2 right-2 text-gray-500 hover:text-gray-700 text-xs bg-white rounded-full w-6 h-6 flex items-center justify-center border border-gray-300 font-bold"
                title="Mostra dettagli calcolo"
              >
                i
              </button>
              <div className="flex items-center gap-4">
                <div className="flex flex-col items-center">
                  <p className="text-sm text-gray-600 font-medium mb-1">
                    Score Giornata
                  </p>
                  <div className="flex items-baseline gap-2">
                    <span
                      className="text-5xl font-bold"
                      style={{ color: scoreColor }}
                    >
                      {scoreBreakdown.total.toFixed(1)}
                    </span>
                    <span className="text-2xl text-gray-400">/10</span>
                  </div>
                  <p
                    className="text-sm font-semibold mt-1"
                    style={{ color: scoreColor }}
                  >
                    {scoreLabel}
                  </p>
                </div>
                <div className="h-16 w-px bg-gray-300 mx-2" />
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div className="flex flex-col">
                    <span className="text-gray-500 text-xs">
                      Ore Nette (75%)
                    </span>
                    <span className="font-bold text-gray-700">
                      {scoreBreakdown.workScore.toFixed(1)}
                    </span>
                    <span className="text-xs text-gray-400">
                      {formatHoursAsHoursMinutes(actualWorkHours)}
                    </span>
                  </div>
                  <div className="flex flex-col">
                    <span className="text-gray-500 text-xs">Volume (25%)</span>
                    <span className="font-bold text-gray-700">
                      {scoreBreakdown.volumeScore.toFixed(1)}
                    </span>
                    <span className="text-xs text-gray-400">
                      {formatHoursAsHoursMinutes(
                        scoreBreakdown.details.totalHours,
                      )}
                    </span>
                  </div>
                </div>
              </div>

              {showScoreDetails && (
                <div className="mt-4 pt-4 border-t border-gray-300">
                  <h3 className="text-sm font-bold text-gray-800 mb-3">
                    📊 Dettagli Calcolo Score
                  </h3>

                  <div className="space-y-3 text-xs">
                    <div className="bg-white rounded p-3 border border-gray-200">
                      <p className="font-semibold text-gray-700 mb-2">
                        Come funziona lo score:
                      </p>
                      <div className="space-y-2 text-gray-600">
                        <p className="text-[11px] leading-relaxed">
                          Lo score si basa su <strong>ore pesate</strong>: ogni
                          ora di attività viene moltiplicata per il peso della
                          categoria/app/dominio.
                        </p>
                        <p className="text-[11px] leading-relaxed">
                          <strong className="text-green-600">
                            Peso positivo
                          </strong>{" "}
                          (es. +1.0): attività produttive che contribuiscono
                          allo score lavoro.
                          <br />
                          <strong className="text-gray-600">
                            Peso neutro
                          </strong>{" "}
                          (0): attività che non influenzano lo score.
                          <br />
                          <strong className="text-red-600">
                            Peso negativo
                          </strong>{" "}
                          (es. -0.5): attività che penalizzano lo score.
                        </p>
                        <p className="text-[11px] leading-relaxed">
                          <strong>Esempio:</strong> 2 ore su un'app con peso
                          +1.5 = 3 ore pesate di lavoro.
                        </p>
                      </div>
                    </div>

                    <div className="bg-white rounded p-3 border border-gray-200">
                      <p className="font-semibold text-gray-700 mb-2">
                        Bilancio Ore Pesate:
                      </p>
                      <div className="space-y-2 text-gray-600">
                        <div className="flex justify-between items-center text-sm">
                          <span className="text-green-700">
                            ✓ Ore positive:
                          </span>
                          <strong className="text-green-700">
                            {formatHoursAsHoursMinutes(
                              scoreBreakdown.details.positiveWeightedHours,
                            )}
                          </strong>
                        </div>
                        <div className="flex justify-between items-center text-sm">
                          <span className="text-red-700">✗ Ore negative:</span>
                          <strong className="text-red-700">
                            {formatHoursAsHoursMinutes(
                              scoreBreakdown.details.negativeWeightedHours,
                            )}
                          </strong>
                        </div>
                        <div className="flex justify-between items-center text-sm pt-2 border-t border-gray-200">
                          <span className="text-blue-900 font-semibold">
                            = Bilancio netto:
                          </span>
                          <strong className="text-blue-900">
                            {formatHoursAsHoursMinutes(
                              scoreBreakdown.details.workHours,
                            )}
                          </strong>
                        </div>
                        <p className="text-[10px] text-gray-500 italic pt-2">
                          Esempio: 3h × peso +3 = 9h positive, 0.5h × peso -2 =
                          1h negative → 9h - 1h = 8h nette
                        </p>
                      </div>
                    </div>

                    <div className="bg-purple-50 rounded p-3 border border-purple-200">
                      <p className="font-semibold text-purple-900 mb-2">
                        Dettaglio App/Domini:
                      </p>
                      <div className="space-y-1 max-h-64 overflow-y-auto">
                        {weightDetails.map((detail) => (
                          <div
                            key={detail.name}
                            className="flex justify-between items-center text-gray-600 py-1 text-[11px]"
                          >
                            <div className="flex flex-col">
                              <span className="font-medium">{detail.name}</span>
                              <span className="text-[10px] text-gray-500 capitalize">
                                {detail.category}
                              </span>
                            </div>
                            <div className="flex gap-3 text-right">
                              <span>
                                Peso:{" "}
                                <strong
                                  className={
                                    detail.weight > 0
                                      ? "text-green-600"
                                      : detail.weight < 0
                                        ? "text-red-600"
                                        : "text-gray-500"
                                  }
                                >
                                  {detail.weight.toFixed(1)}
                                </strong>
                              </span>
                              <span>
                                Ore:{" "}
                                <strong>
                                  {formatHoursAsHoursMinutes(detail.hours)}
                                </strong>
                              </span>
                              <span
                                className={
                                  detail.weight > 0
                                    ? "text-green-600"
                                    : detail.weight < 0
                                      ? "text-red-600"
                                      : "text-gray-500"
                                }
                              >
                                Pesate:{" "}
                                <strong>
                                  {formatHoursAsHoursMinutes(
                                    detail.weightedHours,
                                  )}
                                </strong>
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div className="bg-blue-50 rounded p-3 border border-blue-200">
                      <p className="font-semibold text-blue-900 mb-2">
                        Formula Unificata
                      </p>
                      <p className="text-blue-800 text-[11px] leading-relaxed mb-2">
                        <strong>
                          Score Totale = (Ore Nette × 75%) + (Volume × 25%)
                        </strong>
                      </p>
                      <p className="text-blue-800 text-[11px]">
                        Target ore nette: {settings.scoreConfig.targetWorkHours}
                        h • Min volume: {settings.scoreConfig.minDailyHours}h •
                        Ottimale: {settings.scoreConfig.optimalDailyHours}h
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {(categoryStats.length > 0 || appChartData.length > 0) && (
          <div className="lg:row-span-2 grid grid-cols-1 xl:grid-cols-2 gap-4">
            {categoryStats.length > 0 && (
              <div className="flex flex-col p-4 rounded-lg border border-gray-100">
                <p className="text-sm text-gray-500 mb-3">
                  Distribuzione per Categoria
                </p>
                <div className="flex items-center gap-4">
                  <ResponsiveContainer width="60%" height={280}>
                    <PieChart>
                      <Pie
                        data={chartData}
                        dataKey="durationMinutes"
                        nameKey="name"
                        cx="50%"
                        cy="50%"
                        outerRadius={90}
                        label={false}
                      >
                        {chartData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip
                        content={({ active, payload }: any) => {
                          if (active && payload && payload.length) {
                            const data = payload[0].payload;
                            return (
                              <div className="bg-gray-900 text-white p-3 rounded shadow-lg text-xs">
                                <p className="font-bold capitalize mb-1">
                                  {data.name}
                                </p>
                                <p>
                                  Tempo:{" "}
                                  {formatMinutesAsHoursMinutes(
                                    data.durationMinutes,
                                  )}
                                </p>
                                <p>Percentuale: {data.percentuale}%</p>
                              </div>
                            );
                          }
                          return null;
                        }}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="flex-1 flex flex-col gap-2 text-xs">
                    {categoryStats.map((stat) => (
                      <div key={stat.name} className="flex items-center gap-2">
                        <div
                          className="w-3 h-3 rounded flex-shrink-0"
                          style={{ backgroundColor: stat.color }}
                        />
                        <span className="capitalize font-medium">
                          {stat.name}:
                        </span>
                        <span className="text-gray-600 ml-auto">
                          {stat.percentage.toFixed(1)}%
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {appChartData.length > 0 && (
              <div className="flex flex-col p-4 rounded-lg border border-gray-100">
                <p className="text-sm text-gray-500 mb-3">App più usate</p>
                <ResponsiveContainer width="100%" height={280}>
                  <BarChart
                    data={appChartData}
                    layout="vertical"
                    margin={{ top: 4, right: 12, left: 8, bottom: 4 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                    <XAxis
                      type="number"
                      tick={{ fontSize: 11 }}
                      tickFormatter={(value) =>
                        formatMinutesAsHoursMinutes(Number(value))
                      }
                    />
                    <YAxis
                      type="category"
                      dataKey="shortName"
                      width={115}
                      tick={{ fontSize: 11 }}
                    />
                    <Tooltip
                      content={({ active, payload }: any) => {
                        if (active && payload && payload.length) {
                          const data = payload[0].payload;
                          return (
                            <div className="bg-gray-900 text-white p-3 rounded shadow-lg text-xs">
                              <p className="font-bold mb-1">{data.name}</p>
                              <p>
                                Tempo:{" "}
                                {formatMinutesAsHoursMinutes(
                                  data.durationMinutes,
                                )}
                              </p>
                              <p>Percentuale: {data.percentage}%</p>
                            </div>
                          );
                        }
                        return null;
                      }}
                    />
                    <Bar dataKey="durationMinutes" radius={[0, 6, 6, 0]}>
                      {appChartData.map((entry, index) => (
                        <Cell key={`app-cell-${index}`} fill={entry.color} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>
        )}
      </div>
    </section>
  );
}
