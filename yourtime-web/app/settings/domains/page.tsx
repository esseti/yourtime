"use client";

import React, { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { Download, Upload, Loader2, ArrowUpDown } from "lucide-react";
import { getSettings, saveSettings, getKnownDomains } from "@/app/actions";
import { SettingsData, DEFAULT_SETTINGS } from "@/lib/settings";
import {
  exportDomainMappingsCSV,
  parseMappingsCSV,
} from "@/lib/settingsExport";
import { SettingsNavigation } from "@/components/SettingsNavigation";

type SortField = "name" | "category" | "weight" | "meeting";
type SortDirection = "asc" | "desc";

export default function DomainsSettingsPage() {
  const [settings, setSettings] = useState<SettingsData>(DEFAULT_SETTINGS);
  const [knownDomains, setKnownDomains] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [sortField, setSortField] = useState<SortField>("name");
  const [sortDirection, setSortDirection] = useState<SortDirection>("asc");

  const mapInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    Promise.all([getSettings(), getKnownDomains()])
      .then(([settingsData, domains]) => {
        setSettings(settingsData);
        setKnownDomains(domains);
        setLoading(false);
      })
      .catch((err) => {
        console.error("Failed to load settings or domains", err);
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

  const handleDomainMappingChange = (domain: string, categoryName: string) => {
    const newMappings = { ...settings.domainMappings };
    if (categoryName) {
      newMappings[domain] = categoryName;
    } else {
      delete newMappings[domain];
    }
    const newSettings = { ...settings, domainMappings: newMappings };
    setSettings(newSettings);
    autoSave(newSettings);
  };

  const handleMeetingRelatedToggle = (domain: string) => {
    const newMeetingRelatedDomains = [...settings.meetingRelatedDomains];
    const index = newMeetingRelatedDomains.indexOf(domain);

    if (index > -1) {
      newMeetingRelatedDomains.splice(index, 1);
    } else {
      newMeetingRelatedDomains.push(domain);
    }

    const newSettings = {
      ...settings,
      meetingRelatedDomains: newMeetingRelatedDomains,
    };
    setSettings(newSettings);
    autoSave(newSettings);
  };

  const handleDomainWeightChange = (domain: string, weight: string) => {
    const newDomainWeights = { ...settings.domainWeights };
    if (weight === "") {
      newDomainWeights[domain] = null;
    } else {
      const parsedWeight = parseFloat(weight);
      newDomainWeights[domain] = isNaN(parsedWeight) ? null : parsedWeight;
    }
    const newSettings = { ...settings, domainWeights: newDomainWeights };
    setSettings(newSettings);
    autoSave(newSettings);
  };

  const handleClearDomainWeight = (domain: string) => {
    const newDomainWeights = { ...settings.domainWeights };
    newDomainWeights[domain] = null;
    const newSettings = { ...settings, domainWeights: newDomainWeights };
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

  const getSortedDomains = () => {
    return [...knownDomains].sort((a, b) => {
      let compareResult = 0;

      switch (sortField) {
        case "name":
          compareResult = a.localeCompare(b);
          break;
        case "category": {
          const aCat = settings.domainMappings[a] || "";
          const bCat = settings.domainMappings[b] || "";
          compareResult = aCat.localeCompare(bCat);
          if (compareResult === 0) compareResult = a.localeCompare(b);
          break;
        }
        case "weight": {
          const aWeight = settings.domainWeights[a];
          const bWeight = settings.domainWeights[b];
          const aCatName = settings.domainMappings[a];
          const bCatName = settings.domainMappings[b];
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
          const aIsMeeting = settings.meetingRelatedDomains.includes(a);
          const bIsMeeting = settings.meetingRelatedDomains.includes(b);
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
        Caricamento domini in corso...
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
              Gestisci le categorie, le applicazioni e i domini.
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
              Assegnazione Domini
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
                  exportDomainMappingsCSV(
                    settings.domainMappings,
                    knownDomains,
                    settings.meetingRelatedDomains,
                    settings.domainWeights,
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
            Scegli a quale categoria appartiene ciascun dominio web rilevato nei
            CSV. Le categorie dei domini hanno la precedenza su quelle
            dell&apos;applicazione madre (es. Chrome).
          </p>

          <div className="grid grid-cols-[1fr_auto_auto_auto] gap-x-4 gap-y-3 items-center pb-2 border-b-2 border-gray-300 font-semibold text-sm text-gray-700">
            <button
              onClick={() => handleSort("name")}
              className="flex items-center gap-1 hover:text-gray-900 transition-colors text-left"
            >
              Dominio
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
            {knownDomains.length === 0 ? (
              <p className="text-gray-400 italic text-sm">
                Nessun dominio trovato. Carica prima un file CSV con dati di
                navigazione.
              </p>
            ) : (
              getSortedDomains().map((domain) => {
                const currentCat = settings.domainMappings[domain] || "";
                const hasCategory = !!currentCat;
                const isMeetingRelated =
                  settings.meetingRelatedDomains.includes(domain);
                const domainWeight = settings.domainWeights[domain];
                const category = currentCat
                  ? settings.categories.find((c) => c.name === currentCat)
                  : null;
                return (
                  <div
                    key={domain}
                    className={`grid grid-cols-[1fr_auto_auto_auto] gap-x-4 items-center border-b border-gray-100 pb-3 last:border-0 last:pb-0 rounded-md px-2 py-1 -mx-2 -my-1 ${
                      hasCategory ? "" : "bg-red-50"
                    }`}
                  >
                    <span
                      className="font-medium text-gray-800 truncate"
                      title={domain}
                    >
                      {domain}
                    </span>
                    <select
                      value={currentCat}
                      onChange={(e) =>
                        handleDomainMappingChange(domain, e.target.value)
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
                          domainWeight !== null && domainWeight !== undefined
                            ? domainWeight
                            : ""
                        }
                        onChange={(e) =>
                          handleDomainWeightChange(domain, e.target.value)
                        }
                        placeholder={category ? `${category.weight}` : ""}
                        className="border border-gray-300 rounded-md px-2 py-1 text-sm w-24 flex-shrink-0"
                        title={
                          category ? `Peso categoria: ${category.weight}` : ""
                        }
                      />
                      {domainWeight !== null && domainWeight !== undefined && (
                        <button
                          onClick={() => handleClearDomainWeight(domain)}
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
                        onChange={() => handleMeetingRelatedToggle(domain)}
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
