"use client";

import React, { useState, useCallback } from "react";
import { format } from "date-fns";
import { CalendarEvent } from "@/lib/csvProcessor";
import {
  updateCalendarEventTimes,
  updateCalendarEventIncluded,
  resetCalendarEventOverride,
} from "@/app/actions";
import { Clock, Save, RotateCcw, ChevronDown, ChevronUp } from "lucide-react";

interface CalendarEventEditorProps {
  calendarEvents: CalendarEvent[];
  overrideIds: string[];
  dateString: string;
  onEventsUpdated: () => void;
}

interface EditingState {
  startTime: string;
  endTime: string;
}

export function CalendarEventEditor({
  calendarEvents,
  overrideIds,
  dateString,
  onEventsUpdated,
}: CalendarEventEditorProps) {
  const [editingEventId, setEditingEventId] = useState<string | null>(null);
  const [editState, setEditState] = useState<EditingState>({
    startTime: "",
    endTime: "",
  });
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);
  const [expanded, setExpanded] = useState(false);

  const sortedEvents = [...calendarEvents].sort((a, b) => a.start - b.start);

  const eventIds = new Set(calendarEvents.map((e) => e.id));
  const todayOverrideCount = overrideIds.filter((id) =>
    eventIds.has(id),
  ).length;

  const timestampToTimeString = (ts: number): string => {
    return format(new Date(ts), "HH:mm");
  };

  const timeStringToTimestamp = (
    timeStr: string,
    referenceDate: string,
  ): number => {
    const [hours, minutes] = timeStr.split(":").map(Number);
    const date = new Date(referenceDate);
    date.setHours(hours, minutes, 0, 0);
    return date.getTime();
  };

  const handleStartEdit = useCallback((event: CalendarEvent) => {
    setEditingEventId(event.id);
    setEditState({
      startTime: timestampToTimeString(event.start),
      endTime: timestampToTimeString(event.end),
    });
    setMessage(null);
  }, []);

  const handleCancelEdit = useCallback(() => {
    setEditingEventId(null);
    setMessage(null);
  }, []);

  const handleSave = useCallback(
    async (eventId: string) => {
      const newStart = timeStringToTimestamp(editState.startTime, dateString);
      const newEnd = timeStringToTimestamp(editState.endTime, dateString);

      if (newEnd <= newStart) {
        setMessage({
          type: "error",
          text: "L'orario di fine deve essere dopo l'orario di inizio.",
        });
        return;
      }

      setSaving(true);
      const result = await updateCalendarEventTimes(eventId, newStart, newEnd);
      setSaving(false);

      if (result.success) {
        setEditingEventId(null);
        setMessage({ type: "success", text: "Orario aggiornato." });
        onEventsUpdated();
      } else {
        setMessage({
          type: "error",
          text: "Errore nel salvataggio.",
        });
      }
    },
    [editState, dateString, onEventsUpdated],
  );

  const handleToggleIncluded = useCallback(
    async (eventId: string, currentIncluded: boolean) => {
      setSaving(true);
      const result = await updateCalendarEventIncluded(
        eventId,
        !currentIncluded,
      );
      setSaving(false);

      if (result.success) {
        onEventsUpdated();
      } else {
        setMessage({ type: "error", text: "Errore nel salvataggio." });
      }
    },
    [onEventsUpdated],
  );

  const handleReset = useCallback(
    async (eventId: string) => {
      setSaving(true);
      const result = await resetCalendarEventOverride(eventId);
      setSaving(false);

      if (result.success) {
        setEditingEventId(null);
        setMessage({
          type: "success",
          text: "Orario ripristinato all'originale.",
        });
        onEventsUpdated();
      } else {
        setMessage({
          type: "error",
          text: "Errore nel ripristino.",
        });
      }
    },
    [onEventsUpdated],
  );

  if (sortedEvents.length === 0) {
    return null;
  }

  return (
    <div className="bg-white border border-gray-200 rounded-lg shadow-sm">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between p-4 hover:bg-gray-50 transition-colors rounded-lg"
      >
        <div className="flex items-center gap-3">
          <Clock size={20} className="text-blue-600" />
          <h2 className="text-lg font-semibold text-gray-800">
            Eventi Calendario
          </h2>
          <span className="text-sm text-gray-500">
            ({sortedEvents.length} event
            {sortedEvents.length !== 1 ? "i" : "o"})
          </span>
          {todayOverrideCount > 0 && (
            <span className="text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full font-medium">
              {todayOverrideCount} modificat
              {todayOverrideCount !== 1 ? "i" : "o"}
            </span>
          )}
        </div>
        {expanded ? (
          <ChevronUp size={20} className="text-gray-400" />
        ) : (
          <ChevronDown size={20} className="text-gray-400" />
        )}
      </button>

      {expanded && (
        <div className="border-t border-gray-100 p-4 space-y-3">
          {message && (
            <div
              className={`text-sm px-3 py-2 rounded ${
                message.type === "success"
                  ? "bg-green-50 text-green-700 border border-green-200"
                  : "bg-red-50 text-red-700 border border-red-200"
              }`}
            >
              {message.text}
            </div>
          )}

          {sortedEvents.map((event) => {
            const isEditing = editingEventId === event.id;
            const hasOverride = overrideIds.includes(event.id);
            const durationMinutes = Math.round(
              (event.end - event.start) / 60000,
            );

            return (
              <div
                key={event.id}
                className={`rounded-lg border p-3 transition-colors ${
                  isEditing
                    ? "border-blue-300 bg-blue-50/50"
                    : hasOverride
                      ? "border-amber-200 bg-amber-50/30"
                      : "border-gray-200 hover:bg-gray-50"
                }`}
              >
                <div className="flex items-center gap-3">
                  <button
                    onClick={() =>
                      handleToggleIncluded(event.id, event.included ?? true)
                    }
                    disabled={saving}
                    className={`w-5 h-5 rounded border-2 flex-shrink-0 flex items-center justify-center transition-colors ${
                      event.included
                        ? "bg-green-500 border-green-500 text-white"
                        : "bg-white border-gray-300 text-transparent hover:border-gray-400"
                    }`}
                    title={
                      event.included
                        ? "Incluso — clicca per escludere"
                        : "Escluso — clicca per includere"
                    }
                  >
                    {event.included && (
                      <svg
                        className="w-3 h-3"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                        strokeWidth={3}
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          d="M5 13l4 4L19 7"
                        />
                      </svg>
                    )}
                  </button>
                  <div
                    className="w-3 h-3 rounded-full flex-shrink-0"
                    style={{ backgroundColor: event.calendarColor }}
                  />
                  <div
                    className={`flex-1 min-w-0 ${!event.included ? "opacity-50" : ""}`}
                  >
                    <div className="flex items-center gap-2">
                      <span
                        className={`font-medium text-sm truncate ${event.included ? "text-gray-900" : "text-gray-500 line-through"}`}
                      >
                        {event.title}
                      </span>
                      {event.responseStatus === "tentative" && (
                        <span className="text-[10px] bg-yellow-100 text-yellow-700 px-1.5 py-0.5 rounded font-medium flex-shrink-0">
                          forse
                        </span>
                      )}
                      {hasOverride && (
                        <span className="text-[10px] bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded font-medium flex-shrink-0">
                          modificato
                        </span>
                      )}
                    </div>
                    {!isEditing && (
                      <div className="text-xs text-gray-500 font-mono mt-0.5">
                        {timestampToTimeString(event.start)} –{" "}
                        {timestampToTimeString(event.end)}
                        <span className="ml-2 text-gray-400">
                          ({durationMinutes} min)
                        </span>
                      </div>
                    )}
                  </div>
                  {!isEditing && (
                    <button
                      onClick={() => handleStartEdit(event)}
                      className="text-xs bg-white border border-gray-300 text-gray-600 hover:bg-gray-50 px-3 py-1.5 rounded transition-colors flex-shrink-0"
                    >
                      Modifica
                    </button>
                  )}
                </div>

                {isEditing && (
                  <div className="mt-3 pt-3 border-t border-blue-200">
                    <div className="flex items-center gap-4 mb-3">
                      <div className="flex items-center gap-2">
                        <label className="text-xs font-medium text-gray-600">
                          Inizio:
                        </label>
                        <input
                          type="time"
                          value={editState.startTime}
                          onChange={(e) =>
                            setEditState((prev) => ({
                              ...prev,
                              startTime: e.target.value,
                            }))
                          }
                          className="text-sm border border-gray-300 rounded px-2 py-1 font-mono focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                        />
                      </div>
                      <div className="flex items-center gap-2">
                        <label className="text-xs font-medium text-gray-600">
                          Fine:
                        </label>
                        <input
                          type="time"
                          value={editState.endTime}
                          onChange={(e) =>
                            setEditState((prev) => ({
                              ...prev,
                              endTime: e.target.value,
                            }))
                          }
                          className="text-sm border border-gray-300 rounded px-2 py-1 font-mono focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                        />
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleSave(event.id)}
                        disabled={saving}
                        className="text-xs bg-blue-600 text-white px-3 py-1.5 rounded hover:bg-blue-700 transition-colors flex items-center gap-1.5 disabled:opacity-50"
                      >
                        <Save size={12} />
                        {saving ? "Salvataggio..." : "Salva"}
                      </button>
                      {hasOverride && (
                        <button
                          onClick={() => handleReset(event.id)}
                          disabled={saving}
                          className="text-xs bg-amber-50 border border-amber-300 text-amber-700 px-3 py-1.5 rounded hover:bg-amber-100 transition-colors flex items-center gap-1.5 disabled:opacity-50"
                        >
                          <RotateCcw size={12} />
                          Ripristina originale
                        </button>
                      )}
                      <button
                        onClick={handleCancelEdit}
                        className="text-xs text-gray-500 hover:text-gray-700 px-3 py-1.5 transition-colors"
                      >
                        Annulla
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
