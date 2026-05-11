"use client";

import React, { useState, useEffect, useMemo, useCallback } from "react";
import {
  ProcessedEvent,
  processEvents,
  aggregateIntoSlots,
  CalendarEvent,
} from "@/lib/csvProcessor";
import { Timeline } from "@/components/Timeline";
import { DayStats } from "@/components/DayStats";
import { CalendarEventEditor } from "@/components/CalendarEventEditor";
import {
  getEventsForDate,
  getSettings,
  getCalendarEventsForDay,
  getEventOverrideIds,
} from "@/app/actions";
import { SettingsData, DEFAULT_SETTINGS } from "@/lib/settings";
import { calculateMeetingAttentionScore } from "@/lib/meetingAttentionScore";
import Link from "next/link";
import { useParams } from "next/navigation";
import { format, addDays, subDays, isSameDay } from "date-fns";
import { ArrowLeft, ArrowRight, Calendar } from "lucide-react";

export default function DayView() {
  const params = useParams();
  const dateString = params.date as string;

  const [events, setEvents] = useState<ProcessedEvent[]>([]);
  const [calendarEvents, setCalendarEvents] = useState<CalendarEvent[]>([]);
  const [overrideIds, setOverrideIds] = useState<string[]>([]);
  const [settings, setSettings] = useState<SettingsData>(DEFAULT_SETTINGS);
  const granularity = 60; // Fixed at 1 minute
  const [loading, setLoading] = useState(true);

  const loadData = useCallback(() => {
    if (!dateString) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLoading(true);

    Promise.all([
      getEventsForDate(dateString),
      getSettings(),
      getCalendarEventsForDay(dateString),
      getEventOverrideIds(),
    ])
      .then(([rawEvents, settingsData, calEvents, oIds]) => {
        const processed = processEvents(rawEvents);
        setEvents(processed);
        setSettings(settingsData);
        setCalendarEvents(calEvents);
        setOverrideIds(oIds);
        setLoading(false);
      })
      .catch((err) => {
        console.error(err);
        setLoading(false);
      });
  }, [dateString]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleEventsUpdated = useCallback(() => {
    loadData();
  }, [loadData]);

  const includedCalendarEvents = useMemo(
    () => calendarEvents.filter((e) => e.included),
    [calendarEvents],
  );

  const slots = useMemo(() => {
    const baseSlots = aggregateIntoSlots(events, granularity);

    const eventsWithScores = includedCalendarEvents.map((calEvent) => {
      const score = calculateMeetingAttentionScore(
        calEvent,
        baseSlots,
        settings,
      );
      return {
        ...calEvent,
        attentionScore: score
          ? {
              percentage: score.percentage,
              meetingRelatedSeconds: score.meetingRelatedSeconds,
              totalSeconds: score.totalSeconds,
            }
          : undefined,
      };
    });

    return baseSlots.map((slot) => {
      const slotCalendarEvents = eventsWithScores.filter((calEvent) => {
        return calEvent.start < slot.slotEnd && calEvent.end > slot.slotStart;
      });

      return {
        ...slot,
        calendarEvents:
          slotCalendarEvents.length > 0 ? slotCalendarEvents : undefined,
      };
    });
  }, [events, granularity, includedCalendarEvents, settings]);

  const currentDate = useMemo(() => {
    return new Date(dateString);
  }, [dateString]);

  const previousDay = useMemo(() => {
    return format(subDays(currentDate, 1), "yyyy-MM-dd");
  }, [currentDate]);

  const nextDay = useMemo(() => {
    return format(addDays(currentDate, 1), "yyyy-MM-dd");
  }, [currentDate]);

  const isToday = useMemo(() => {
    return isSameDay(currentDate, new Date());
  }, [currentDate]);

  return (
    <div className="min-h-screen bg-gray-50 p-4 md:p-8 font-[family-name:var(--font-geist-sans)] text-gray-900">
      <main className="w-full mx-auto flex flex-col gap-8">
        <header className="flex flex-col gap-4 border-b border-gray-200 pb-6">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <Link
                href="/"
                className="text-sm bg-white border border-gray-300 text-gray-700 hover:bg-gray-50 px-3 py-1.5 rounded transition-colors flex items-center gap-2"
              >
                <Calendar size={16} />
                Calendario
              </Link>
              <h1 className="text-3xl font-bold tracking-tight text-gray-900">
                Dettaglio: <span className="text-blue-600">{dateString}</span>
              </h1>
            </div>
            <div className="flex items-center gap-2">
              <Link
                href={`/day/${previousDay}`}
                className="bg-white border border-gray-300 text-gray-700 hover:bg-gray-50 px-4 py-2 rounded-md transition-colors flex items-center gap-2"
              >
                <ArrowLeft size={18} />
                Precedente
              </Link>
              <Link
                href={`/day/${nextDay}`}
                className={`border px-4 py-2 rounded-md transition-colors flex items-center gap-2 ${
                  isToday
                    ? "bg-gray-100 border-gray-200 text-gray-400 cursor-not-allowed pointer-events-none"
                    : "bg-white border-gray-300 text-gray-700 hover:bg-gray-50"
                }`}
                aria-disabled={isToday}
              >
                Successivo
                <ArrowRight size={18} />
              </Link>
            </div>
          </div>
          <p className="text-gray-500">
            Analisi dettagliata delle attività per la giornata selezionata.
          </p>
        </header>

        {loading ? (
          <div className="flex justify-center p-12 text-gray-400">
            Caricamento dati in corso...
          </div>
        ) : events.length === 0 ? (
          <div className="flex justify-center p-12 text-gray-500 bg-white border border-gray-200 rounded-lg">
            Nessun dato trovato per questa data.
          </div>
        ) : (
          <>
            <DayStats events={events} settings={settings} />

            {calendarEvents.length > 0 && (
              <CalendarEventEditor
                calendarEvents={calendarEvents}
                overrideIds={overrideIds}
                dateString={dateString}
                onEventsUpdated={handleEventsUpdated}
              />
            )}

            <div className="flex flex-col gap-4">
              <h2 className="text-xl font-semibold text-gray-800">
                Visualizzazione Timeline
              </h2>
              <Timeline
                slots={slots}
                granularitySeconds={granularity}
                settings={settings}
              />
            </div>
          </>
        )}
      </main>
    </div>
  );
}
