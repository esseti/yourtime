"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { Loader2 } from "lucide-react";
import { getSettings, saveSettings } from "@/app/actions";
import { SettingsData, DEFAULT_SETTINGS } from "@/lib/settings";
import { SettingsNavigation } from "@/components/SettingsNavigation";

export default function ScoreSettingsPage() {
  const [settings, setSettings] = useState<SettingsData>(DEFAULT_SETTINGS);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    getSettings()
      .then((settingsData) => {
        setSettings(settingsData);
        setLoading(false);
      })
      .catch((err) => {
        console.error("Failed to load settings", err);
        setLoading(false);
      });
  }, []);

  const autoSave = async (newSettings: SettingsData) => {
    setSaving(true);
    try {
      await saveSettings(newSettings);
    } catch (err) {
      console.error("Auto-save failed", err);
    } finally {
      setTimeout(() => setSaving(false), 500);
    }
  };

  const handleScoreConfigChange = (
    field: keyof typeof settings.scoreConfig,
    value: string | number,
  ) => {
    const newSettings = {
      ...settings,
      scoreConfig: {
        ...settings.scoreConfig,
        [field]: value,
      },
    };
    setSettings(newSettings);
    autoSave(newSettings);
  };

  if (loading) {
    return (
      <div className="min-h-screen flex justify-center p-12 text-gray-400">
        Caricamento configurazione score in corso...
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-4 md:p-8 font-[family-name:var(--font-geist-sans)] text-gray-900">
      <main className="max-w-4xl mx-auto flex flex-col gap-8">
        <header className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b border-gray-200 pb-6">
          <div className="flex flex-col gap-2">
            <div className="flex items-center gap-4">
              <Link
                href="/"
                className="text-sm bg-white border border-gray-300 text-gray-700 hover:bg-gray-50 px-3 py-1.5 rounded transition-colors"
              >
                ← Torna al Calendario
              </Link>
              <h1 className="text-3xl font-bold tracking-tight text-gray-900">
                Impostazioni Score
              </h1>
            </div>
            <p className="text-gray-500">
              Configura i parametri per il calcolo dello score giornaliero.
            </p>
          </div>
          <div className="flex items-center gap-2 h-10">
            {saving && (
              <div className="flex items-center gap-2 text-sm text-gray-500 bg-white px-3 py-1.5 rounded-full border border-gray-200 shadow-sm">
                <Loader2 size={14} className="animate-spin text-blue-500" />
                Salvataggio...
              </div>
            )}
          </div>
        </header>

        <SettingsNavigation />

        <section className="bg-white p-6 rounded-xl shadow-sm border border-gray-200 flex flex-col gap-6">
          <div>
            <h2 className="text-xl font-bold text-gray-800 mb-4">
              Parametri Target
            </h2>
            <div className="grid gap-4">
              <div className="flex flex-col gap-2">
                <label className="text-sm font-medium text-gray-700">
                  Ore di Lavoro Target (giornaliere)
                </label>
                <input
                  type="number"
                  min="1"
                  max="16"
                  step="0.5"
                  value={settings.scoreConfig.targetWorkHours}
                  onChange={(e) =>
                    handleScoreConfigChange(
                      "targetWorkHours",
                      parseFloat(e.target.value),
                    )
                  }
                  className="border border-gray-300 rounded-md px-3 py-2 text-sm w-full max-w-xs"
                />
                <p className="text-xs text-gray-500">
                  Numero ideale di ore di lavoro per una giornata produttiva
                  (default: 8h)
                </p>
              </div>

              <div className="flex flex-col gap-2">
                <label className="text-sm font-medium text-gray-700">
                  Ore Minime Giornaliere
                </label>
                <input
                  type="number"
                  min="1"
                  max="12"
                  step="0.5"
                  value={settings.scoreConfig.minDailyHours}
                  onChange={(e) =>
                    handleScoreConfigChange(
                      "minDailyHours",
                      parseFloat(e.target.value),
                    )
                  }
                  className="border border-gray-300 rounded-md px-3 py-2 text-sm w-full max-w-xs"
                />
                <p className="text-xs text-gray-500">
                  Sotto questo valore, la giornata è considerata incompleta
                  (default: 4h)
                </p>
              </div>

              <div className="flex flex-col gap-2">
                <label className="text-sm font-medium text-gray-700">
                  Ore Ottimali Giornaliere
                </label>
                <input
                  type="number"
                  min="4"
                  max="16"
                  step="0.5"
                  value={settings.scoreConfig.optimalDailyHours}
                  onChange={(e) =>
                    handleScoreConfigChange(
                      "optimalDailyHours",
                      parseFloat(e.target.value),
                    )
                  }
                  className="border border-gray-300 rounded-md px-3 py-2 text-sm w-full max-w-xs"
                />
                <p className="text-xs text-gray-500">
                  Range ottimale di ore totali logged per giorno (default: 10h)
                </p>
              </div>
            </div>
          </div>

          <div className="border-t border-gray-100 pt-6">
            <h2 className="text-xl font-bold text-gray-800 mb-2">
              Come Funziona lo Score
            </h2>
            <div className="text-sm text-gray-600 space-y-3">
              <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
                <h3 className="font-semibold text-purple-900 mb-2">
                  Sistema di Ore Pesate
                </h3>
                <p className="text-purple-800 mb-2">
                  Lo score si basa su <strong>ore nette</strong>: ore positive -
                  ore negative.
                </p>
                <ul className="list-disc list-inside space-y-1 text-purple-800">
                  <li>
                    <strong className="text-green-700">Ore positive</strong>:
                    attività con peso {">"} 0 moltiplicate per il peso
                  </li>
                  <li>
                    <strong className="text-red-700">Ore negative</strong>:
                    attività con peso {"<"} 0 moltiplicate per |peso|
                  </li>
                  <li>
                    <strong>Ore nette</strong>: positive - negative = lavoro
                    effettivo
                  </li>
                </ul>
                <p className="text-purple-800 mt-2 italic">
                  Esempio: 6h × +1.0 = 6h positive, 1h × -2.0 = 2h negative → 6
                  - 2 = 4h nette
                </p>
              </div>

              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <h3 className="font-semibold text-blue-900 mb-2">
                  Formula Unificata
                </h3>
                <p className="text-blue-800 font-semibold mb-2">
                  Score Totale = (Ore Nette × 75%) + (Volume × 25%)
                </p>
                <ul className="list-disc list-inside space-y-1 text-blue-800">
                  <li>
                    <strong>75% Ore Nette:</strong> Qualità del lavoro - ore
                    nette vs target
                  </li>
                  <li>
                    <strong>25% Volume:</strong> Quantità - ore totali attive vs
                    ottimale
                  </li>
                </ul>
                <p className="text-blue-800 text-xs mt-2 italic">
                  Focus sulla qualità: le ore nette sono il fattore principale
                </p>
              </div>

              <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                <h3 className="font-semibold text-gray-900 mb-2">
                  Esempi di Score (target 8h nette, ottimale 10h volume)
                </h3>
                <ul className="space-y-2 text-gray-700 text-sm">
                  <li>
                    • 8h nette / 10h totali
                    <br />
                    <span className="text-xs text-gray-600 ml-3">
                      Ore nette: 10/10 • Volume: 10/10 →{" "}
                      <strong>(10×0.75)+(10×0.25) = 10/10</strong> (Eccellente)
                    </span>
                  </li>
                  <li>
                    • 6h nette / 8h totali
                    <br />
                    <span className="text-xs text-gray-600 ml-3">
                      Ore nette: 8.5/10 • Volume: 8/10 →{" "}
                      <strong>(8.5×0.75)+(8×0.25) = 8.4/10</strong> (Ottimo)
                    </span>
                  </li>
                  <li>
                    • 4h nette (es. 6h +1.0 - 2h -1.0) / 8h totali
                    <br />
                    <span className="text-xs text-gray-600 ml-3">
                      Ore nette: 5.5/10 • Volume: 8/10 →{" "}
                      <strong>(5.5×0.75)+(8×0.25) = 6.1/10</strong> (Discreto)
                    </span>
                  </li>
                  <li>
                    • 10h nette / 12h totali (oltre target!)
                    <br />
                    <span className="text-xs text-gray-600 ml-3">
                      Ore nette: 10/10 • Volume: 10/10 →{" "}
                      <strong>(10×0.75)+(10×0.25) = 10/10</strong> (Eccellente+)
                    </span>
                  </li>
                  <li>
                    • 2h nette / 3h totali
                    <br />
                    <span className="text-xs text-gray-600 ml-3">
                      Ore nette: 2.5/10 • Volume: 3.75/10 →{" "}
                      <strong>(2.5×0.75)+(3.75×0.25) = 2.8/10</strong>{" "}
                      (Insufficiente)
                    </span>
                  </li>
                </ul>
              </div>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
