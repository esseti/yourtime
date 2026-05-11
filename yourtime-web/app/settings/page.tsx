"use client";

import React, { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { Download, Upload, Loader2 } from "lucide-react";
import { getSettings, saveSettings } from "@/app/actions";
import {
  Category,
  SettingsData,
  DEFAULT_SETTINGS,
  normalizeCategoryName,
  generateRandomColor,
} from "@/lib/settings";
import { exportCategoriesCSV, parseCategoriesCSV } from "@/lib/settingsExport";
import { SettingsNavigation } from "@/components/SettingsNavigation";

export default function CategoriesSettingsPage() {
  const [settings, setSettings] = useState<SettingsData>(DEFAULT_SETTINGS);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const catInputRef = useRef<HTMLInputElement>(null);

  // For adding a new category
  const [newCatName, setNewCatName] = useState("");
  const [newCatColor, setNewCatColor] = useState("#3b82f6"); // Default blue

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

  const handleAddCategory = () => {
    if (!newCatName.trim()) return;

    const normalizedName = normalizeCategoryName(newCatName);

    if (settings.categories.some((cat) => cat.name === normalizedName)) {
      alert(
        `La categoria "${newCatName}" esiste già (i nomi sono case-insensitive).`,
      );
      return;
    }

    const newCat: Category = {
      name: normalizedName,
      color: newCatColor,
      weight: 0,
      dailyLimitHours: undefined,
    };
    const newSettings = {
      ...settings,
      categories: [...settings.categories, newCat],
    };
    setSettings(newSettings);
    setNewCatName("");
    setNewCatColor(generateRandomColor());
    autoSave(newSettings);
  };

  const handleDeleteCategory = (categoryName: string) => {
    const newCats = settings.categories.filter((c) => c.name !== categoryName);
    const newAppMappings = { ...settings.appMappings };
    for (const [appName, catName] of Object.entries(newAppMappings)) {
      if (catName === categoryName) delete newAppMappings[appName];
    }
    const newDomainMappings = { ...settings.domainMappings };
    for (const [domain, catName] of Object.entries(newDomainMappings)) {
      if (catName === categoryName) delete newDomainMappings[domain];
    }
    const newSettings = {
      ...settings,
      categories: newCats,
      appMappings: newAppMappings,
      domainMappings: newDomainMappings,
    };
    setSettings(newSettings);
    autoSave(newSettings);
  };

  const handleColorChange = (categoryName: string, newColor: string) => {
    const newCategories = settings.categories.map((cat) =>
      cat.name === categoryName ? { ...cat, color: newColor } : cat,
    );
    const newSettings = { ...settings, categories: newCategories };
    setSettings(newSettings);
    autoSave(newSettings);
  };

  const handleWeightChange = (categoryName: string, newWeight: number) => {
    const newCategories = settings.categories.map((cat) =>
      cat.name === categoryName ? { ...cat, weight: newWeight } : cat,
    );
    const newSettings = { ...settings, categories: newCategories };
    setSettings(newSettings);
    autoSave(newSettings);
  };

  const handleLimitChange = (categoryName: string, newLimit: string) => {
    const limitValue = newLimit === "" ? undefined : parseFloat(newLimit);
    const newCategories = settings.categories.map((cat) =>
      cat.name === categoryName ? { ...cat, dailyLimitHours: limitValue } : cat,
    );
    const newSettings = { ...settings, categories: newCategories };
    setSettings(newSettings);
    autoSave(newSettings);
  };

  const handleImportCategories = async (
    e: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const importedCats = await parseCategoriesCSV(file);
      const newSettings = { ...settings, categories: importedCats };
      setSettings(newSettings);
      await autoSave(newSettings);
    } catch (err) {
      console.error(err);
      alert("Errore nell'importazione delle categorie");
    } finally {
      if (e.target) e.target.value = "";
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex justify-center p-12 text-gray-400">
        Caricamento categorie in corso...
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
              Gestisci le tue categorie personalizzate.
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
            <h2 className="text-xl font-bold text-gray-800">Categorie</h2>
            <div className="flex gap-2">
              <button
                onClick={() => catInputRef.current?.click()}
                title="Importa Categorie"
                className="p-2 hover:bg-gray-100 rounded-md transition-colors text-gray-600"
              >
                <Upload size={20} />
              </button>
              <button
                onClick={() => exportCategoriesCSV(settings.categories)}
                title="Esporta Categorie"
                className="p-2 hover:bg-gray-100 rounded-md transition-colors text-gray-600"
              >
                <Download size={20} />
              </button>

              <input
                type="file"
                ref={catInputRef}
                onChange={handleImportCategories}
                accept=".csv"
                className="hidden"
              />
            </div>
          </div>

          <div className="grid gap-3">
            {settings.categories.map((cat) => (
              <div
                key={cat.name}
                className="flex flex-col border border-gray-100 p-4 rounded-md bg-gray-50 gap-3"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="relative group">
                      <div
                        className="w-8 h-8 rounded border shadow-sm cursor-pointer"
                        style={{ backgroundColor: cat.color }}
                      ></div>
                      <input
                        type="color"
                        value={cat.color}
                        onChange={(e) =>
                          handleColorChange(cat.name, e.target.value)
                        }
                        className="absolute inset-0 w-8 h-8 opacity-0 cursor-pointer"
                        title="Cambia colore"
                      />
                    </div>
                    <span className="font-semibold capitalize">{cat.name}</span>
                    <span className="text-xs font-mono text-gray-400 uppercase">
                      {cat.color}
                    </span>
                  </div>
                  <button
                    onClick={() => handleDeleteCategory(cat.name)}
                    className="text-red-500 hover:text-red-700 text-sm font-medium"
                  >
                    Elimina
                  </button>
                </div>
                <div className="flex gap-4 items-center text-sm">
                  <div className="flex items-center gap-2">
                    <label className="text-gray-600 font-medium">Peso:</label>
                    <input
                      type="number"
                      step="0.1"
                      value={cat.weight}
                      onChange={(e) =>
                        handleWeightChange(
                          cat.name,
                          parseFloat(e.target.value) || 0,
                        )
                      }
                      placeholder="es. -1, 0, 0.5, 1"
                      className="border border-gray-300 rounded px-2 py-1 w-32 text-sm"
                    />
                  </div>
                  <div className="flex items-center gap-2">
                    <label className="text-gray-600 font-medium">
                      Limite ore/giorno:
                    </label>
                    <input
                      type="number"
                      min="0"
                      step="0.5"
                      value={cat.dailyLimitHours ?? ""}
                      onChange={(e) =>
                        handleLimitChange(cat.name, e.target.value)
                      }
                      placeholder="Nessuno"
                      className="border border-gray-300 rounded px-2 py-1 w-24 text-sm"
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div className="flex flex-col sm:flex-row gap-3 items-end mt-2 pt-4 border-t border-gray-100">
            <div className="flex flex-col gap-1 flex-1">
              <label className="text-sm font-medium text-gray-700">
                Nome Nuova Categoria
              </label>
              <input
                type="text"
                value={newCatName}
                onChange={(e) => setNewCatName(e.target.value)}
                placeholder="es. Lavoro, Studio..."
                className="border border-gray-300 rounded-md px-3 py-2 text-sm"
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-sm font-medium text-gray-700">
                Colore
              </label>
              <input
                type="color"
                value={newCatColor}
                onChange={(e) => setNewCatColor(e.target.value)}
                className="w-12 h-10 border border-gray-300 rounded-md p-1 cursor-pointer"
              />
            </div>
            <button
              onClick={handleAddCategory}
              className="bg-gray-800 hover:bg-gray-900 text-white px-4 py-2 rounded-md text-sm font-medium transition-colors h-10"
            >
              Aggiungi
            </button>
          </div>
        </section>
      </main>
    </div>
  );
}
