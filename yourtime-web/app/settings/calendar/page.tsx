"use client";

import React, { useState, useEffect, Suspense } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import {
  Calendar,
  RefreshCw,
  LogOut,
  CheckCircle,
  XCircle,
  Loader2,
} from "lucide-react";
import {
  checkGoogleAuth,
  getGoogleCalendars,
  updateCalendarSettings,
  getSelectedCalendars,
  forceSyncCalendars,
} from "@/app/actions";

interface CalendarInfo {
  id: string;
  summary: string;
  backgroundColor: string;
  selected: boolean;
}

function CalendarSettingsContent() {
  const searchParams = useSearchParams();
  const [authenticated, setAuthenticated] = useState(false);
  const [userEmail, setUserEmail] = useState<string | undefined>();
  const [calendars, setCalendars] = useState<CalendarInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);

  useEffect(() => {
    const success = searchParams.get("success");
    const error = searchParams.get("error");

    if (success) {
      setMessage({
        type: "success",
        text: "Autenticazione completata con successo!",
      });
    } else if (error) {
      const errorMessages: Record<string, string> = {
        access_denied: "Accesso negato. Riprova.",
        no_code: "Codice di autorizzazione mancante.",
        auth_failed: "Autenticazione fallita. Riprova.",
      };
      setMessage({
        type: "error",
        text: errorMessages[error] || "Errore durante l'autenticazione.",
      });
    }

    loadAuthStatus();
  }, [searchParams]);

  const loadAuthStatus = async () => {
    setLoading(true);
    try {
      const authStatus = await checkGoogleAuth();
      setAuthenticated(authStatus.authenticated);
      setUserEmail(authStatus.email);

      if (authStatus.authenticated) {
        const [calendarsData, selectedIds] = await Promise.all([
          getGoogleCalendars(),
          getSelectedCalendars(),
        ]);

        const calendarsWithSelection = calendarsData.map(
          (cal: CalendarInfo) => ({
            ...cal,
            selected: selectedIds.includes(cal.id),
          }),
        );

        setCalendars(calendarsWithSelection);
      }
    } catch (error) {
      console.error("Error loading auth status:", error);
      setMessage({
        type: "error",
        text: "Errore nel caricamento dello stato di autenticazione.",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleLogin = () => {
    window.location.href = "/api/auth/google/login";
  };

  const handleLogout = async () => {
    try {
      const response = await fetch("/api/auth/google/logout", {
        method: "POST",
      });
      if (response.ok) {
        setAuthenticated(false);
        setUserEmail(undefined);
        setCalendars([]);
        setMessage({ type: "success", text: "Disconnesso con successo." });
      } else {
        setMessage({
          type: "error",
          text: "Errore durante la disconnessione.",
        });
      }
    } catch (error) {
      console.error("Error logging out:", error);
      setMessage({ type: "error", text: "Errore durante la disconnessione." });
    }
  };

  const handleToggleCalendar = (calendarId: string) => {
    setCalendars((prev) =>
      prev.map((cal) =>
        cal.id === calendarId ? { ...cal, selected: !cal.selected } : cal,
      ),
    );
  };

  const handleSaveSettings = async () => {
    setSaving(true);
    try {
      const selectedIds = calendars
        .filter((cal) => cal.selected)
        .map((cal) => cal.id);
      const result = await updateCalendarSettings(selectedIds);

      if (result.success) {
        setMessage({
          type: "success",
          text: "Impostazioni salvate con successo!",
        });
      } else {
        setMessage({
          type: "error",
          text: "Errore nel salvataggio delle impostazioni.",
        });
      }
    } catch (error) {
      console.error("Error saving settings:", error);
      setMessage({
        type: "error",
        text: "Errore nel salvataggio delle impostazioni.",
      });
    } finally {
      setSaving(false);
    }
  };

  const handleSync = async () => {
    setSyncing(true);
    try {
      const result = await forceSyncCalendars();
      if (result.success) {
        setMessage({ type: "success", text: "Sincronizzazione completata!" });
      } else {
        setMessage({
          type: "error",
          text: "Errore durante la sincronizzazione.",
        });
      }
    } catch (error) {
      console.error("Error syncing:", error);
      setMessage({
        type: "error",
        text: "Errore durante la sincronizzazione.",
      });
    } finally {
      setSyncing(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 p-4 md:p-8 font-[family-name:var(--font-geist-sans)]">
      <main className="max-w-4xl mx-auto">
        <header className="mb-8">
          <div className="flex items-center gap-4 mb-4">
            <Link
              href="/settings"
              className="text-sm bg-white border border-gray-300 text-gray-700 hover:bg-gray-50 px-3 py-1.5 rounded transition-colors"
            >
              ← Impostazioni
            </Link>
            <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-2">
              <Calendar size={32} />
              Google Calendar
            </h1>
          </div>
          <p className="text-gray-600">
            Connetti il tuo Google Calendar per visualizzare i meeting nella
            timeline.
          </p>
        </header>

        {message && (
          <div
            className={`mb-6 p-4 rounded-lg flex items-center gap-3 ${
              message.type === "success"
                ? "bg-green-50 text-green-800 border border-green-200"
                : "bg-red-50 text-red-800 border border-red-200"
            }`}
          >
            {message.type === "success" ? (
              <CheckCircle size={20} />
            ) : (
              <XCircle size={20} />
            )}
            <span>{message.text}</span>
          </div>
        )}

        {loading ? (
          <div className="flex justify-center items-center p-12">
            <Loader2 className="animate-spin" size={32} />
          </div>
        ) : !authenticated ? (
          <div className="bg-white border border-gray-200 rounded-lg p-8 text-center">
            <Calendar size={64} className="mx-auto mb-4 text-gray-400" />
            <h2 className="text-xl font-semibold mb-2">Non sei connesso</h2>
            <p className="text-gray-600 mb-6">
              Connetti il tuo account Google per sincronizzare i tuoi calendari.
            </p>
            <button
              onClick={handleLogin}
              className="bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 transition-colors font-semibold"
            >
              Connetti Google Calendar
            </button>
          </div>
        ) : (
          <div className="space-y-6">
            <div className="bg-white border border-gray-200 rounded-lg p-6">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h2 className="text-lg font-semibold text-gray-900">
                    Account Connesso
                  </h2>
                  <p className="text-sm text-gray-600">{userEmail}</p>
                </div>
                <button
                  onClick={handleLogout}
                  className="flex items-center gap-2 bg-red-50 text-red-700 px-4 py-2 rounded-lg hover:bg-red-100 transition-colors border border-red-200"
                >
                  <LogOut size={16} />
                  Disconnetti
                </button>
              </div>
            </div>

            <div className="bg-white border border-gray-200 rounded-lg p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold text-gray-900">
                  Calendari Disponibili
                </h2>
                <button
                  onClick={handleSync}
                  disabled={syncing}
                  className="flex items-center gap-2 bg-blue-50 text-blue-700 px-4 py-2 rounded-lg hover:bg-blue-100 transition-colors border border-blue-200 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <RefreshCw
                    size={16}
                    className={syncing ? "animate-spin" : ""}
                  />
                  {syncing ? "Sincronizzazione..." : "Sincronizza Ora"}
                </button>
              </div>

              {calendars.length === 0 ? (
                <p className="text-gray-500 text-center py-8">
                  Nessun calendario trovato. Prova a sincronizzare.
                </p>
              ) : (
                <div className="space-y-3">
                  {calendars.map((calendar) => (
                    <label
                      key={calendar.id}
                      className="flex items-center gap-3 p-3 rounded-lg border border-gray-200 hover:bg-gray-50 cursor-pointer transition-colors"
                    >
                      <input
                        type="checkbox"
                        checked={calendar.selected}
                        onChange={() => handleToggleCalendar(calendar.id)}
                        className="w-5 h-5 text-blue-600 rounded focus:ring-2 focus:ring-blue-500"
                      />
                      <div
                        className="w-4 h-4 rounded-full flex-shrink-0"
                        style={{ backgroundColor: calendar.backgroundColor }}
                      />
                      <span className="flex-1 font-medium text-gray-900">
                        {calendar.summary}
                      </span>
                    </label>
                  ))}
                </div>
              )}

              {calendars.length > 0 && (
                <div className="mt-6 flex justify-end">
                  <button
                    onClick={handleSaveSettings}
                    disabled={saving}
                    className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 transition-colors font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {saving ? "Salvataggio..." : "Salva Impostazioni"}
                  </button>
                </div>
              )}
            </div>

            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <h3 className="font-semibold text-blue-900 mb-2">
                ℹ️ Informazioni
              </h3>
              <ul className="text-sm text-blue-800 space-y-1">
                <li>
                  • Gli eventi vengono sincronizzati automaticamente per oggi e
                  l'ultima settimana
                </li>
                <li>
                  • I meeting appariranno nella timeline con un bordo colorato
                  sull'orario
                </li>
                <li>
                  • Passa il mouse sull'orario per vedere i dettagli dell'evento
                </li>
              </ul>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

export default function CalendarSettingsPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-gray-50 flex items-center justify-center">
          <Loader2 className="animate-spin" size={32} />
        </div>
      }
    >
      <CalendarSettingsContent />
    </Suspense>
  );
}
