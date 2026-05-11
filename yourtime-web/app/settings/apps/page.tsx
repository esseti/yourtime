"use client";

import React, { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { Download, Upload, Loader2, ArrowUpDown } from "lucide-react";
import { getSettings, saveSettings, getKnownApps } from "@/app/actions";
import { SettingsData, DEFAULT_SETTINGS } from "@/lib/settings";
import { exportAppMappingsCSV, parseMappingsCSV } from "@/lib/settingsExport";
import { SettingsNavigation } from "@/components/SettingsNavigation";

type SortField = "name" | "category" | "weight" | "meeting";
type SortDirection = "asc" | "desc";

export default function AppsSettingsPage() {
  const [settings, setSettings] = useState<SettingsData>(DEFAULT_SETTINGS);
  const [knownApps, setKnownApps] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [sortField, setSortField] = useState<SortField>("name");
  const [sortDirection, setSortDirection] = useState<SortDirection>("asc");

  const mapInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    Promise.all([getSettings(), getKnownApps()])
      .then(([settingsData, apps]) => {
        setSettings(settingsData);
        setKnownApps(apps);
        setLoading(false);
      })
      .catch((err) => {
        console.error("Failed to load settings or apps", err);
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

  const handleAppMappingChange = (appName: string, categoryName: string) => {
    const newMappings = { ...settings.appMappings };
    if (categoryName) {
      newMappings[appName] = categoryName;
    } else {
      delete newMappings[appName];
    }
    const newSettings = { ...settings, appMappings: newMappings };
    setSettings(newSettings);
    autoSave(newSettings);
  };

  const handleMeetingRelatedToggle = (appName: string) => {
    const newMeetingRelatedApps = [...settings.meetingRelatedApps];
    const index = newMeetingRelatedApps.indexOf(appName);

    if (index > -1) {
      newMeetingRelatedApps.splice(index, 1);
    } else {
      newMeetingRelatedApps.push(appName);
    }

    const newSettings = {
      ...settings,
      meetingRelatedApps: newMeetingRelatedApps,
    };
    setSettings(newSettings);
    autoSave(newSettings);
  };

  const handleAppWeightChange = (appName: string, weight: string) => {
    const newAppWeights = { ...settings.appWeights };
    if (weight === "") {
      newAppWeights[appName] = null;
    } else {
      const parsedWeight = parseFloat(weight);
      newAppWeights[appName] = isNaN(parsedWeight) ? null : parsedWeight;
    }
    const newSettings = { ...settings, appWeights: newAppWeights };
    setSettings(newSettings);
    autoSave(newSettings);
  };

  const handleClearAppWeight = (appName: string) => {
    const newAppWeights = { ...settings.appWeights };
    newAppWeights[appName] = null;
    const newSettings = { ...settings, appWeights: newAppWeights };
    setSettings(newSettings);
    autoSave(newSettings);
  };

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortDirection("asc");
    }
  };

  const getSortedApps = () => {
    return [...knownApps].sort((a, b) => {
      let compareResult = 0;

      switch (sortField) {
        case "name":
          compareResult = a.localeCompare(b);
          break;
        case "category": {
          const aCat = settings.appMappings[a] || "";
          const bCat = settings.appMappings[b] || "";
          compareResult = aCat.localeCompare(bCat);
          if (compareResult === 0) compareResult = a.localeCompare(b);
          break;
        }
        case "weight": {
          const aWeight = settings.appWeights[a];
          const bWeight = settings.appWeights[b];
          const aCatName = settings.appMappings[a];
          const bCatName = settings.appMappings[b];
          const aCat = aCatName
            ? settings.categories.find((c) => c.name === aCatName)
            : null;
          const bCat = bCatName
            ? settings.categories.find((c) => c.name === bCatName)
            : null;
          const aEffectiveWeight =
            aWeight !== null && aWeight !== undefined
              ? aWeight
              : (aCat?.weight ?? 0);
          const bEffectiveWeight =
            bWeight !== null && bWeight !== undefined
              ? bWeight
              : (bCat?.weight ?? 0);
          compareResult = aEffectiveWeight - bEffectiveWeight;
          if (compareResult === 0) compareResult = a.localeCompare(b);
          break;
        }
        case "meeting": {
          const aIsMeeting = settings.meetingRelatedApps.includes(a);
          const bIsMeeting = settings.meetingRelatedApps.includes(b);
          compareResult = Number(bIsMeeting) - Number(aIsMeeting);
          if (compareResult === 0) compareResult = a.localeCompare(b);
          break;
        }
      }

      return sortDirection === "asc" ? compareResult : -compareResult;
    });
  };

  const handleImportMappings = async (
    e: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const {
        appMappings,
        domainMappings,
        appWeights,
        domainWeights,
        meetingRelatedApps,
        meetingRelatedDomains,
        missingCategories,
      } = await parseMappingsCSV(file, settings.categories);

      if (missingCategories.length > 0) {
        alert(
          `Le seguenti categorie non esistono e i loro mapping sono stati ignorati:\n${missingCategories.join(
            ", ",
          )}\n\nCrea prima queste categorie nella sezione Categorie.`,
        );
      }

      const mergedMeetingRelatedApps = Array.from(
        new Set([...settings.meetingRelatedApps, ...meetingRelatedApps]),
      );

      const mergedMeetingRelatedDomains = Array.from(
        new Set([...settings.meetingRelatedDomains, ...meetingRelatedDomains]),
      );

      const newSettings = {
        ...settings,
        appMappings: { ...settings.appMappings, ...appMappings },
        domainMappings: { ...settings.domainMappings, ...domainMappings },
        appWeights: { ...settings.appWeights, ...appWeights },
        domainWeights: { ...settings.domainWeights, ...domainWeights },
        meetingRelatedApps: mergedMeetingRelatedApps,
        meetingRelatedDomains: mergedMeetingRelatedDomains,
      };
      setSettings(newSettings);
      await autoSave(newSettings);
    } catch (err) {
      console.error(err);
      alert("Errore nell'importazione delle assegnazioni");
    } finally {
      if (e.target) e.target.value = "";
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex justify-center p-12 text-gray-400">
        Caricamento applicazioni in corso...
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
                Impostazioni
              </h1>
            </div>
            <p className="text-gray-500">
              Assegna le applicazioni alle tue categorie.
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

        <section className="bg-white p-6 rounded-xl shadow-sm border border-gray-200 flex flex-col gap-6 relative">
          <div className="flex justify-between items-center">
            <h2 className="text-xl font-bold text-gray-800">
              Assegnazione App
            </h2>
            <div className="flex gap-2">
              <button
                onClick={() => mapInputRef.current?.click()}
                title="Importa Assegnazioni"
                className="p-2 hover:bg-gray-100 rounded-md transition-colors text-gray-600"
              >
                <Upload size={20} />
              </button>
              <button
                onClick={() =>
                  exportAppMappingsCSV(
                    settings.appMappings,
                    knownApps,
                    settings.meetingRelatedApps,
                    settings.appWeights,
                  )
                }
                title="Esporta Assegnazioni"
                className="p-2 hover:bg-gray-100 rounded-md transition-colors text-gray-600"
              >
                <Download size={20} />
              </button>

              <input
                type="file"
                ref={mapInputRef}
                onChange={handleImportMappings}
                accept=".csv"
                className="hidden"
              />
            </div>
          </div>
          <p className="text-sm text-gray-500 -mt-4">
            Scegli a quale categoria appartiene ciascuna applicazione rilevata
            nei CSV.
          </p>

          <div className="grid grid-cols-[1fr_auto_auto_auto] gap-x-4 gap-y-3 items-center pb-2 border-b-2 border-gray-300 font-semibold text-sm text-gray-700">
            <button
              onClick={() => handleSort("name")}
              className="flex items-center gap-1 hover:text-gray-900 transition-colors text-left"
            >
              Applicazione
              <ArrowUpDown
                size={14}
                className={
                  sortField === "name" ? "text-blue-600" : "text-gray-400"
                }
              />
            </button>
            <button
              onClick={() => handleSort("category")}
              className="flex items-center gap-1 hover:text-gray-900 transition-colors w-64"
            >
              Categoria
              <ArrowUpDown
                size={14}
                className={
                  sortField === "category" ? "text-blue-600" : "text-gray-400"
                }
              />
            </button>
            <button
              onClick={() => handleSort("weight")}
              className="flex items-center gap-1 hover:text-gray-900 transition-colors w-40 justify-center"
            >
              Peso Specifico
              <ArrowUpDown
                size={14}
                className={
                  sortField === "weight" ? "text-blue-600" : "text-gray-400"
                }
              />
            </button>
            <button
              onClick={() => handleSort("meeting")}
              className="flex items-center gap-1 hover:text-gray-900 transition-colors w-32 justify-center"
            >
              Meeting
              <ArrowUpDown
                size={14}
                className={
                  sortField === "meeting" ? "text-blue-600" : "text-gray-400"
                }
              />
            </button>
          </div>

          <div className="grid gap-3">
            {knownApps.length === 0 ? (
              <p className="text-gray-400 italic text-sm">
                Nessuna app trovata. Carica prima un file CSV.
              </p>
            ) : (
              getSortedApps().map((appName) => {
                const hasCategory = !!settings.appMappings[appName];
                const isMeetingRelated =
                  settings.meetingRelatedApps.includes(appName);
                const appWeight = settings.appWeights[appName];
                const categoryName = settings.appMappings[appName];
                const category = categoryName
                  ? settings.categories.find((c) => c.name === categoryName)
                  : null;
                return (
                  <div
                    key={appName}
                    className={`grid grid-cols-[1fr_auto_auto_auto] gap-x-4 items-center border-b border-gray-100 pb-3 last:border-0 last:pb-0 rounded-md px-2 py-1 -mx-2 -my-1 ${
                      hasCategory ? "" : "bg-red-50"
                    }`}
                  >
                    <span
                      className="font-medium text-gray-800 truncate"
                      title={appName}
                    >
                      {appName}
                    </span>
                    <select
                      value={settings.appMappings[appName] || ""}
                      onChange={(e) =>
                        handleAppMappingChange(appName, e.target.value)
                      }
                      className="border border-gray-300 rounded-md px-3 py-1.5 text-sm w-64 flex-shrink-0"
                    >
                      <option value="">Nessuna Categoria</option>
                      {settings.categories.map((cat) => (
                        <option key={cat.name} value={cat.name}>
                          {cat.name}
                        </option>
                      ))}
                    </select>
                    <div className="w-40 flex items-center gap-1">
                      <input
                        type="number"
                        step="0.1"
                        value={
                          appWeight !== null && appWeight !== undefined
                            ? appWeight
                            : ""
                        }
                        onChange={(e) =>
                          handleAppWeightChange(appName, e.target.value)
                        }
                        placeholder={category ? `${category.weight}` : ""}
                        className="border border-gray-300 rounded-md px-2 py-1 text-sm w-24 flex-shrink-0"
                        title={
                          category ? `Peso categoria: ${category.weight}` : ""
                        }
                      />
                      {appWeight !== null && appWeight !== undefined && (
                        <button
                          onClick={() => handleClearAppWeight(appName)}
                          className="text-red-500 hover:text-red-700 text-sm font-bold"
                          title="Cancella peso specifico"
                        >
                          ×
                        </button>
                      )}
                    </div>
                    <div className="w-32 flex justify-center">
                      <input
                        type="checkbox"
                        checked={isMeetingRelated}
                        onChange={() => handleMeetingRelatedToggle(appName)}
                        className="w-5 h-5 text-blue-600 rounded focus:ring-2 focus:ring-blue-500 cursor-pointer"
                        title="Funzionale ai meeting"
                      />
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </section>
      </main>
    </div>
  );
}
