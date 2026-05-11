import React from "react";
import { format } from "date-fns";
import { SlotData, CalendarEvent } from "@/lib/csvProcessor";
import { SettingsData, DEFAULT_SETTINGS } from "@/lib/settings";
import { formatSeconds } from "@/lib/meetingAttentionScore";

interface TimelineProps {
  slots: SlotData[];
  granularitySeconds: number;
  settings?: SettingsData;
}

type TimelineRow =
  | {
      type: "slot";
      key: string;
      slot: SlotData;
    }
  | {
      type: "off-summary";
      key: string;
      totalMinutes: number;
    };

const OFF_COLLAPSE_SLOT_THRESHOLD = 3;

export function Timeline({
  slots,
  granularitySeconds,
  settings = DEFAULT_SETTINGS,
}: TimelineProps) {
  if (slots.length === 0) {
    return (
      <div className="p-4 text-gray-500 text-center">
        Nessun dato da visualizzare.
      </div>
    );
  }

  // Get color and category name from settings or generate a fallback
  const getAppColorAndCategory = (
    appName: string,
    domain?: string,
  ): { color: string; categoryName: string | null } => {
    if (domain) {
      const domainCategoryName = settings.domainMappings[domain];
      if (domainCategoryName) {
        const category = settings.categories.find(
          (c) => c.name === domainCategoryName,
        );
        if (category) {
          return { color: category.color, categoryName: category.name };
        }
      }
    }

    const categoryName = settings.appMappings[appName];
    if (categoryName) {
      const category = settings.categories.find((c) => c.name === categoryName);
      if (category) {
        return { color: category.color, categoryName: category.name };
      }
    }

    // Fallback if not mapped
    const fallbackColors = ["#f3f4f6", "#e5e7eb", "#d1d5db"];
    let hash = 0;
    for (let i = 0; i < appName.length; i++) {
      hash = appName.charCodeAt(i) + ((hash << 5) - hash);
    }
    return {
      color: fallbackColors[Math.abs(hash) % fallbackColors.length],
      categoryName: null,
    };
  };

  // Check if a fragment is meeting-related
  const isMeetingRelated = (appName: string, domain?: string): boolean => {
    // If domain is present, check domain first
    if (domain) {
      return settings.meetingRelatedDomains.includes(domain);
    }
    // Only check app if no domain is available
    if (settings.meetingRelatedApps.includes(appName)) {
      return true;
    }
    return false;
  };

  // Get effective weight for a fragment (domain > app > category)
  const getEffectiveWeight = (
    appName: string,
    domain?: string,
  ): { weight: number; source: string } => {
    if (domain) {
      const domainWeight = settings.domainWeights[domain];
      if (domainWeight !== null && domainWeight !== undefined) {
        return { weight: domainWeight, source: `dominio "${domain}"` };
      }
      const categoryName = settings.domainMappings[domain];
      if (categoryName) {
        const category = settings.categories.find(
          (c) => c.name === categoryName,
        );
        if (category) {
          return {
            weight: category.weight,
            source: `categoria "${category.name}"`,
          };
        }
      }
    }

    const appWeight = settings.appWeights[appName];
    if (appWeight !== null && appWeight !== undefined) {
      return { weight: appWeight, source: `app "${appName}"` };
    }

    const categoryName = settings.appMappings[appName];
    if (categoryName) {
      const category = settings.categories.find((c) => c.name === categoryName);
      if (category) {
        return {
          weight: category.weight,
          source: `categoria "${category.name}"`,
        };
      }
    }

    return { weight: 0, source: "default (non mappato)" };
  };

  // Helper to convert hex to rgba with alpha
  const hexToRgba = (hex: string, alpha: number) => {
    const h = hex.replace("#", "");
    const r = parseInt(h.substring(0, 2), 16);
    const g = parseInt(h.substring(2, 4), 16);
    const b = parseInt(h.substring(4, 6), 16);
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
  };

  // Helper to determine text color
  // Since background has very low alpha (0.15), it's essentially on white background
  // Always use dark text for maximum readability
  const getTextColor = () => {
    return "#111827"; // gray-900 for best readability on light background
  };

  const formatMinutesAsHHMM = (minutes: number): string => {
    const hoursPart = Math.floor(minutes / 60);
    const minutesPart = minutes % 60;
    return `${hoursPart.toString().padStart(2, "0")}:${minutesPart
      .toString()
      .padStart(2, "0")}`;
  };

  const isOffSlot = (slot: SlotData): boolean => {
    if (slot.fragments.length === 0) {
      return false;
    }

    return slot.fragments.every((fragment) => {
      const { categoryName } = getAppColorAndCategory(
        fragment.appName,
        fragment.domain,
      );
      return categoryName?.toLowerCase() === "off";
    });
  };

  const timelineRows: TimelineRow[] = (() => {
    const rows: TimelineRow[] = [];
    let index = 0;

    while (index < slots.length) {
      const currentSlot = slots[index];

      if (!isOffSlot(currentSlot)) {
        rows.push({
          type: "slot",
          key: `slot-${currentSlot.slotStart}`,
          slot: currentSlot,
        });
        index += 1;
        continue;
      }

      let endIndex = index;
      while (endIndex + 1 < slots.length && isOffSlot(slots[endIndex + 1])) {
        endIndex += 1;
      }

      const runLength = endIndex - index + 1;

      if (runLength > OFF_COLLAPSE_SLOT_THRESHOLD) {
        const firstSlot = slots[index];
        const lastSlot = slots[endIndex];
        const totalMinutes = Math.max(
          1,
          Math.round((runLength * granularitySeconds) / 60),
        );

        rows.push({
          type: "slot",
          key: `slot-${firstSlot.slotStart}`,
          slot: firstSlot,
        });
        rows.push({
          type: "off-summary",
          key: `off-summary-${firstSlot.slotStart}-${lastSlot.slotStart}`,
          totalMinutes,
        });
        rows.push({
          type: "slot",
          key: `slot-${lastSlot.slotStart}`,
          slot: lastSlot,
        });
      } else {
        for (let runIndex = index; runIndex <= endIndex; runIndex += 1) {
          rows.push({
            type: "slot",
            key: `slot-${slots[runIndex].slotStart}`,
            slot: slots[runIndex],
          });
        }
      }

      index = endIndex + 1;
    }

    return rows;
  })();

  return (
    <div className="flex flex-col w-full max-w-full mx-auto mt-6 bg-white border border-gray-200 rounded-lg shadow-sm">
      {timelineRows.map((row) => {
        if (row.type === "off-summary") {
          return (
            <div
              key={row.key}
              className="flex flex-row items-stretch border-b border-gray-100 bg-gray-50/70"
            >
              <div className="w-28 p-3 flex-shrink-0 border-r border-gray-100 bg-gray-50/80 rounded-l border-l-4 border-l-gray-300 flex items-center justify-center">
                <span className="font-mono text-xs text-gray-500">...</span>
              </div>
              <div className="flex-grow min-h-[40px] p-2 flex items-center">
                <div className="w-full rounded border border-dashed border-gray-300 bg-white/80 px-3 py-2 text-xs text-gray-600 font-mono">
                  <div>...</div>
                  <div>{formatMinutesAsHHMM(row.totalMinutes)}</div>
                </div>
              </div>
            </div>
          );
        }

        const slot = row.slot;
        const isEmpty = slot.fragments.length === 0;

        // Find the most present category in this slot
        let dominantColor = "#e5e7eb"; // default gray
        if (!isEmpty) {
          const categoryDurations = new Map<string, number>();
          slot.fragments.forEach((fragment) => {
            const { color } = getAppColorAndCategory(
              fragment.appName,
              fragment.domain,
            );
            const current = categoryDurations.get(color) || 0;
            categoryDurations.set(color, current + fragment.duration);
          });

          let maxDuration = 0;
          categoryDurations.forEach((duration, color) => {
            if (duration > maxDuration) {
              maxDuration = duration;
              dominantColor = color;
            }
          });
        }

        const hasCalendarEvents =
          slot.calendarEvents && slot.calendarEvents.length > 0;
        const calendarEventColor =
          hasCalendarEvents && slot.calendarEvents
            ? slot.calendarEvents[0].calendarColor
            : undefined;

        return (
          <div
            key={row.key}
            className="flex flex-row items-stretch border-b border-gray-100 last:border-0 hover:bg-gray-50 transition-colors"
          >
            {/* Time label */}
            <div
              className="group/time relative w-28 p-3 flex-shrink-0 text-xs font-mono text-gray-700 font-semibold flex flex-col items-center justify-center border-r border-gray-100 bg-gray-50/50 rounded-l border-l-4"
              style={{
                borderLeftColor: dominantColor,
                borderRightWidth: hasCalendarEvents ? "4px" : "1px",
                borderRightColor: hasCalendarEvents
                  ? calendarEventColor
                  : undefined,
              }}
            >
              <span>{format(new Date(slot.slotStart), "HH:mm:ss")}</span>
              <span className="text-[9px] text-gray-500 mt-0.5">
                {Intl.DateTimeFormat().resolvedOptions().timeZone}
              </span>

              {/* Calendar Events Tooltip */}
              {hasCalendarEvents && (
                <div className="absolute left-full ml-2 top-1/2 -translate-y-1/2 hidden group-hover/time:flex flex-col z-50 w-80 p-4 bg-gray-900 text-white text-xs rounded-lg shadow-xl whitespace-normal break-words pointer-events-none">
                  <div className="font-bold text-sm mb-3 border-b border-gray-700 pb-2">
                    📅 Eventi Calendario
                  </div>
                  {slot.calendarEvents!.map((event, idx) => (
                    <div
                      key={event.id}
                      className={`${idx > 0 ? "mt-3 pt-3 border-t border-gray-700" : ""}`}
                    >
                      {event.attentionScore &&
                        event.attentionScore.totalSeconds > 0 && (
                          <div className="mb-3 p-2 bg-gray-800 rounded border border-gray-700">
                            <div className="font-semibold text-sm mb-2 flex items-center gap-2">
                              📊 Score Attenzione:{" "}
                              <span className="text-blue-400">
                                {event.attentionScore.percentage.toFixed(1)}%
                              </span>
                            </div>
                            <div className="text-gray-300 text-[10px] space-y-1">
                              <div className="flex items-center gap-1">
                                <span className="text-green-400">✓</span>
                                <span>
                                  Attività meeting:{" "}
                                  {formatSeconds(
                                    event.attentionScore.meetingRelatedSeconds,
                                  )}
                                </span>
                              </div>
                              <div className="flex items-center gap-1">
                                <span className="text-red-400">✗</span>
                                <span>
                                  Altre attività:{" "}
                                  {formatSeconds(
                                    event.attentionScore.totalSeconds -
                                      event.attentionScore
                                        .meetingRelatedSeconds,
                                  )}
                                </span>
                              </div>
                            </div>
                          </div>
                        )}
                      <div className="flex items-start gap-2 mb-2">
                        <div
                          className="w-3 h-3 rounded-full flex-shrink-0 mt-0.5"
                          style={{ backgroundColor: event.calendarColor }}
                        />
                        <div className="flex-1">
                          <div className="font-semibold text-sm mb-1">
                            {event.title}
                          </div>
                          <div className="text-gray-300 text-[10px] font-mono">
                            {format(new Date(event.start), "HH:mm")} -{" "}
                            {format(new Date(event.end), "HH:mm")}
                          </div>
                        </div>
                      </div>
                      {event.description && (
                        <div className="text-gray-200 text-[11px] leading-relaxed mb-2 italic">
                          {event.description}
                        </div>
                      )}
                      {event.attendees && event.attendees.length > 0 && (
                        <div className="text-gray-300 text-[10px] mb-1">
                          <span className="font-semibold">Partecipanti:</span>{" "}
                          {event.attendees.slice(0, 3).join(", ")}
                          {event.attendees.length > 3 &&
                            ` +${event.attendees.length - 3} altri`}
                        </div>
                      )}
                      {event.meetingLink && (
                        <div className="text-blue-400 text-[10px] truncate">
                          <span className="font-semibold">Link:</span>{" "}
                          {event.meetingLink}
                        </div>
                      )}
                    </div>
                  ))}
                  {/* Triangolino a sinistra */}
                  <div className="absolute right-full top-1/2 -translate-y-1/2 w-0 h-0 border-t-4 border-b-4 border-r-4 border-t-transparent border-b-transparent border-r-gray-900"></div>
                </div>
              )}
            </div>

            {/* Event slot */}
            <div className="flex-grow flex flex-row items-stretch min-h-[40px] p-1 gap-1">
              {!isEmpty ? (
                <>
                  {slot.fragments.map((fragment, idx) => {
                    const { color: bgColor, categoryName } =
                      getAppColorAndCategory(fragment.appName, fragment.domain);
                    const { weight, source } = getEffectiveWeight(
                      fragment.appName,
                      fragment.domain,
                    );
                    const textColor = getTextColor();

                    return (
                      <div
                        key={`${slot.slotStart}-${idx}`}
                        className={`group relative flex flex-col p-2 rounded border-2 shadow-sm min-w-0`}
                        style={{
                          flex: `${fragment.duration} ${fragment.duration} 0%`,
                          backgroundColor: hexToRgba(bgColor, 0.15),
                          borderColor: bgColor,
                          color: textColor,
                        }}
                      >
                        {/* Contenuto visibile nel blocco */}
                        <div className="flex justify-between items-center w-full h-full overflow-hidden">
                          <span className="font-bold text-[10px] sm:text-xs truncate uppercase tracking-tight">
                            {categoryName?.toLowerCase() === "off" ? (
                              "System Off"
                            ) : fragment.domain ? (
                              <>
                                {fragment.domain}{" "}
                                <span className="text-[8px] sm:text-[10px] opacity-60">
                                  ({fragment.appName})
                                </span>
                              </>
                            ) : (
                              fragment.appName
                            )}
                          </span>
                          <span className="text-[9px] font-mono opacity-70 whitespace-nowrap ml-2">
                            {Math.round(fragment.duration)}s
                          </span>
                        </div>

                        {/* Popup / Tooltip visibile all'hover */}
                        <div className="absolute left-1/2 -translate-x-1/2 bottom-full mb-2 hidden group-hover:flex flex-col z-50 w-64 p-3 bg-gray-900 text-white text-xs rounded shadow-lg whitespace-normal break-words pointer-events-none">
                          <div className="font-bold text-sm mb-2">
                            {categoryName?.toLowerCase() === "off" ? (
                              "System Off"
                            ) : fragment.domain ? (
                              <>
                                {fragment.domain}{" "}
                                <span className="opacity-60">
                                  ({fragment.appName})
                                </span>
                              </>
                            ) : (
                              fragment.appName
                            )}
                          </div>
                          {categoryName && (
                            <div className="mb-2 text-gray-300">
                              <span className="font-semibold">Categoria:</span>{" "}
                              <span className="capitalize">{categoryName}</span>
                            </div>
                          )}
                          <div className="mb-2 text-gray-300 font-mono">
                            <span className="font-semibold">Durata:</span>{" "}
                            {Math.round(fragment.duration)}s
                          </div>
                          <div className="mb-2 pb-2 border-b border-gray-700">
                            <div className="text-gray-300">
                              <span className="font-semibold">Peso:</span>{" "}
                              <span
                                className={`font-bold ${
                                  weight > 0
                                    ? "text-green-400"
                                    : weight < 0
                                      ? "text-red-400"
                                      : "text-gray-400"
                                }`}
                              >
                                {weight.toFixed(1)}
                              </span>
                            </div>
                            <div className="text-gray-400 text-[10px] mt-1">
                              da {source}
                            </div>
                          </div>
                          <div className="mb-2 pb-2 border-b border-gray-700">
                            <div className="flex items-center gap-2">
                              <span className="font-semibold">Meeting:</span>
                              {isMeetingRelated(
                                fragment.appName,
                                fragment.domain,
                              ) ? (
                                <span className="flex items-center gap-1 text-green-400">
                                  <span>✓</span>
                                  <span className="text-[10px]">OK</span>
                                </span>
                              ) : (
                                <span className="flex items-center gap-1 text-red-400">
                                  <span>✗</span>
                                  <span className="text-[10px]">
                                    Non adatto
                                  </span>
                                </span>
                              )}
                            </div>
                          </div>
                          {fragment.details && (
                            <div className="text-gray-100 leading-relaxed italic pt-2">
                              {fragment.details}
                            </div>
                          )}
                          {/* Triangolino in basso */}
                          <div className="absolute left-1/2 -translate-x-1/2 top-full w-0 h-0 border-l-4 border-r-4 border-t-4 border-l-transparent border-r-transparent border-t-gray-900"></div>
                        </div>
                      </div>
                    );
                  })}
                  {/* Spacer for remaining time in slot */}
                  {(() => {
                    const totalDuration = slot.fragments.reduce(
                      (acc, f) => acc + f.duration,
                      0,
                    );
                    const remaining = granularitySeconds - totalDuration;
                    if (remaining > 1) {
                      return (
                        <div
                          className="flex-shrink-0"
                          style={{ flex: `${remaining} ${remaining} 0%` }}
                        />
                      );
                    }
                    return null;
                  })()}
                </>
              ) : (
                <div className="flex items-center px-3 text-gray-300 text-xs italic">
                  Nessuna attività
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
