"use server";

import fs from "fs/promises";
import path from "path";
import Papa from "papaparse";
import { RawEvent } from "@/lib/csvProcessor";
import { SettingsData, DEFAULT_SETTINGS } from "@/lib/settings";
import {
  getCalendarEventsForDate,
  getAvailableCalendars,
  saveCalendarSettings,
  getCalendarSettings,
  syncCalendars,
  saveEventOverride,
  deleteEventOverride,
  loadEventOverrides,
  type CalendarEvent,
  type CalendarInfo,
  type CalendarSettings,
} from "@/lib/calendarSync";
import { isAuthenticated, loadAuthTokens } from "@/lib/googleAuth";

const DATA_DIR = path.join(process.cwd(), "data");
const SETTINGS_FILE = path.join(DATA_DIR, "settings.json");
const CACHE_FILE = path.join(DATA_DIR, ".scores_cache.json");

interface ScoresCache {
  version: number;
  csvMtimes: Record<string, number>;
  settingsMtime: number;
  dates: string[];
  scores: Record<string, number>;
}

async function loadCache(): Promise<ScoresCache | null> {
  try {
    const content = await fs.readFile(CACHE_FILE, "utf-8");
    return JSON.parse(content) as ScoresCache;
  } catch {
    return null;
  }
}

async function saveCache(cache: ScoresCache): Promise<void> {
  await fs.writeFile(CACHE_FILE, JSON.stringify(cache));
}

async function isCacheValid(cache: ScoresCache): Promise<boolean> {
  try {
    const files = await fs.readdir(DATA_DIR);
    const csvFiles = files.filter((f) => f.endsWith(".csv"));

    if (csvFiles.length !== Object.keys(cache.csvMtimes).length) return false;

    for (const file of csvFiles) {
      const stat = await fs.stat(path.join(DATA_DIR, file));
      const mtime = stat.mtimeMs;
      if (cache.csvMtimes[file] !== mtime) return false;
    }

    try {
      const stat = await fs.stat(SETTINGS_FILE);
      if (cache.settingsMtime !== stat.mtimeMs) return false;
    } catch {
      if (cache.settingsMtime !== 0) return false;
    }

    return true;
  } catch {
    return false;
  }
}

async function buildCache(): Promise<ScoresCache> {
  const { processEvents } = await import("@/lib/csvProcessor");
  const { calculateDayScore } = await import("@/lib/scoreCalculator");

  await ensureDataDir();
  const files = await fs.readdir(DATA_DIR);
  const csvFiles = files.filter((f) => f.endsWith(".csv"));

  const csvMtimes: Record<string, number> = {};
  const dateEventsMap = new Map<string, { timestamp: number; appName: string; details: string; domain?: string }[]>();

  for (const file of csvFiles) {
    const filePath = path.join(DATA_DIR, file);
    const [content, stat] = await Promise.all([
      fs.readFile(filePath, "utf-8"),
      fs.stat(filePath),
    ]);
    csvMtimes[file] = stat.mtimeMs;

    const results = Papa.parse(content, { skipEmptyLines: true });
    const data = results.data as string[][];

    let startIndex = 0;
    if (data.length > 0) {
      const firstCell = data[0][0]?.toLowerCase();
      if (firstCell && (firstCell.includes("time") || firstCell.includes("date"))) {
        startIndex = 1;
      }
    }

    for (let i = startIndex; i < data.length; i++) {
      const row = data[i];
      if (row.length >= 2) {
        const dateStr = row[0];
        const timestamp = new Date(dateStr).getTime();
        if (!isNaN(timestamp)) {
          const d = new Date(timestamp);
          const ds = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

          if (!dateEventsMap.has(ds)) dateEventsMap.set(ds, []);

          const appName = row[1]?.trim() || "Unknown App";
          const details = row[2]?.trim() || "";
          let domain: string | undefined;
          const extraDetails = row[3]?.trim();
          if (extraDetails && extraDetails.startsWith("http")) {
            try {
              domain = new URL(extraDetails).hostname;
            } catch { /* ignore */ }
          }
          dateEventsMap.get(ds)!.push({ timestamp, appName, details, domain });
        }
      }
    }
  }

  let settingsMtime = 0;
  try {
    const stat = await fs.stat(SETTINGS_FILE);
    settingsMtime = stat.mtimeMs;
  } catch { /* no settings file */ }

  const settings = await getSettings();
  const scores: Record<string, number> = {};
  const dates = Array.from(dateEventsMap.keys()).sort((a, b) => b.localeCompare(a));

  for (const [date, rawEvents] of dateEventsMap) {
    rawEvents.sort((a, b) => a.timestamp - b.timestamp);
    const events = processEvents(rawEvents);
    if (events.length > 0) {
      scores[date] = calculateDayScore(events, settings);
    }
  }

  return { version: 1, csvMtimes, settingsMtime, dates, scores };
}

export async function getDatesAndScores(): Promise<{ dates: string[]; scores: Record<string, number> }> {
  await ensureDataDir();
  const cached = await loadCache();
  if (cached && await isCacheValid(cached)) {
    return { dates: cached.dates, scores: cached.scores };
  }
  const fresh = await buildCache();
  await saveCache(fresh);
  return { dates: fresh.dates, scores: fresh.scores };
}

async function ensureDataDir() {
  try {
    await fs.access(DATA_DIR);
  } catch {
    await fs.mkdir(DATA_DIR, { recursive: true });
  }
}

export async function uploadCsvFile(formData: FormData) {
  const file = formData.get("file") as File;
  if (!file) throw new Error("Nessun file selezionato");

  await ensureDataDir();
  const buffer = Buffer.from(await file.arrayBuffer());
  const safeName = file.name.replace(/[^a-zA-Z0-9.\-_]/g, "_");
  const filePath = path.join(DATA_DIR, safeName);

  await fs.writeFile(filePath, buffer);
  await fs.rm(CACHE_FILE, { force: true });
  return { success: true, fileName: safeName };
}

export async function getAvailableDates(): Promise<string[]> {
  await ensureDataDir();
  const files = await fs.readdir(DATA_DIR);
  const csvFiles = files.filter((f) => f.endsWith(".csv"));

  const dates = new Set<string>();

  for (const file of csvFiles) {
    const content = await fs.readFile(path.join(DATA_DIR, file), "utf-8");
    const results = Papa.parse(content, { skipEmptyLines: true });
    const data = results.data as string[][];

    let startIndex = 0;
    if (data.length > 0) {
      const firstCell = data[0][0]?.toLowerCase();
      if (
        firstCell &&
        (firstCell.includes("time") || firstCell.includes("date"))
      ) {
        startIndex = 1;
      }
    }

    for (let i = startIndex; i < data.length; i++) {
      const row = data[i];
      if (row.length >= 2) {
        const dateStr = row[0];
        const timestamp = new Date(dateStr).getTime();
        if (!isNaN(timestamp)) {
          const d = new Date(timestamp);
          const formatted = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
          dates.add(formatted);
        }
      }
    }
  }

  return Array.from(dates).sort((a, b) => b.localeCompare(a));
}

export async function getEventsForDate(
  dateString: string,
): Promise<RawEvent[]> {
  await ensureDataDir();
  const files = await fs.readdir(DATA_DIR);
  const csvFiles = files.filter((f) => f.endsWith(".csv"));

  const rawEvents: RawEvent[] = [];

  for (const file of csvFiles) {
    const content = await fs.readFile(path.join(DATA_DIR, file), "utf-8");
    const results = Papa.parse(content, { skipEmptyLines: true });
    const data = results.data as string[][];

    let startIndex = 0;
    if (data.length > 0) {
      const firstCell = data[0][0]?.toLowerCase();
      if (
        firstCell &&
        (firstCell.includes("time") || firstCell.includes("date"))
      ) {
        startIndex = 1;
      }
    }

    for (let i = startIndex; i < data.length; i++) {
      const row = data[i];
      if (row.length >= 2) {
        const dateStr = row[0];
        const timestamp = new Date(dateStr).getTime();
        if (!isNaN(timestamp)) {
          const d = new Date(timestamp);
          const ds = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
          if (ds === dateString) {
            const appName = row[1]?.trim() || "Unknown App";
            const details = row[2]?.trim() || "";
            let domain: string | undefined;
            const extraDetails = row[3]?.trim();
            if (extraDetails && extraDetails.startsWith("http")) {
              try {
                const url = new URL(extraDetails);
                domain = url.hostname;
              } catch {
                // Ignore invalid URL
              }
            }
            rawEvents.push({ timestamp, appName, details, domain });
          }
        }
      }
    }
  }

  rawEvents.sort((a, b) => a.timestamp - b.timestamp);
  return rawEvents;
}

export async function getSettings(): Promise<SettingsData> {
  await ensureDataDir();
  try {
    const content = await fs.readFile(SETTINGS_FILE, "utf-8");
    const parsed = JSON.parse(content);

    const categories = (parsed.categories || DEFAULT_SETTINGS.categories).map(
      (cat: any) => ({
        ...cat,
        weight:
          cat.weight !== undefined ? cat.weight : cat.name === "lavoro" ? 1 : 0,
        dailyLimitHours: cat.dailyLimitHours,
      }),
    );

    return {
      ...DEFAULT_SETTINGS,
      ...parsed,
      categories,
      appMappings: parsed.appMappings || {},
      domainMappings: parsed.domainMappings || {},
      scoreConfig: parsed.scoreConfig || DEFAULT_SETTINGS.scoreConfig,
      meetingRelatedApps: parsed.meetingRelatedApps || [],
      meetingRelatedDomains: parsed.meetingRelatedDomains || [],
    };
  } catch {
    return DEFAULT_SETTINGS;
  }
}

export async function saveSettings(
  settings: SettingsData,
): Promise<{ success: boolean }> {
  await ensureDataDir();
  await fs.writeFile(SETTINGS_FILE, JSON.stringify(settings, null, 2));
  return { success: true };
}

export async function getKnownApps(): Promise<string[]> {
  await ensureDataDir();
  const files = await fs.readdir(DATA_DIR);
  const csvFiles = files.filter((f) => f.endsWith(".csv"));

  const appNames = new Set<string>();

  for (const file of csvFiles) {
    const content = await fs.readFile(path.join(DATA_DIR, file), "utf-8");
    const results = Papa.parse(content, { skipEmptyLines: true });
    const data = results.data as string[][];

    let startIndex = 0;
    if (data.length > 0) {
      const firstCell = data[0][0]?.toLowerCase();
      if (
        firstCell &&
        (firstCell.includes("time") || firstCell.includes("date"))
      ) {
        startIndex = 1;
      }
    }

    for (let i = startIndex; i < data.length; i++) {
      const row = data[i];
      if (row.length >= 2) {
        const appName = row[1]?.trim();
        if (appName) {
          appNames.add(appName);
        }
      }
    }
  }

  return Array.from(appNames).sort((a, b) => a.localeCompare(b));
}

export async function getKnownDomains(): Promise<string[]> {
  await ensureDataDir();
  const files = await fs.readdir(DATA_DIR);
  const csvFiles = files.filter((f) => f.endsWith(".csv"));

  const domains = new Set<string>();

  for (const file of csvFiles) {
    const content = await fs.readFile(path.join(DATA_DIR, file), "utf-8");
    const results = Papa.parse(content, { skipEmptyLines: true });
    const data = results.data as string[][];

    let startIndex = 0;
    if (data.length > 0) {
      const firstCell = data[0][0]?.toLowerCase();
      if (
        firstCell &&
        (firstCell.includes("time") || firstCell.includes("date"))
      ) {
        startIndex = 1;
      }
    }

    for (let i = startIndex; i < data.length; i++) {
      const row = data[i];
      if (row.length >= 4) {
        const extraDetails = row[3]?.trim();
        if (extraDetails && extraDetails.startsWith("http")) {
          try {
            const url = new URL(extraDetails);
            if (url.hostname) {
              domains.add(url.hostname);
            }
          } catch {
            // Ignora URL non validi
          }
        }
      }
    }
  }

  return Array.from(domains).sort((a, b) => a.localeCompare(b));
}

export async function getDayScore(dateString: string): Promise<number | null> {
  try {
    const { processEvents } = await import("@/lib/csvProcessor");
    const { calculateDayScore } = await import("@/lib/scoreCalculator");

    const rawEvents = await getEventsForDate(dateString);
    if (rawEvents.length === 0) return null;

    const events = processEvents(rawEvents);
    const settings = await getSettings();

    return calculateDayScore(events, settings);
  } catch (error) {
    console.error(`Error calculating score for ${dateString}:`, error);
    return null;
  }
}

export async function getCalendarEventsForDay(
  dateString: string,
): Promise<CalendarEvent[]> {
  try {
    return await getCalendarEventsForDate(dateString);
  } catch (error) {
    console.error(`Error getting calendar events for ${dateString}:`, error);
    return [];
  }
}

export async function getGoogleCalendars(): Promise<CalendarInfo[]> {
  try {
    return await getAvailableCalendars();
  } catch (error) {
    console.error("Error getting calendars:", error);
    return [];
  }
}

export async function updateCalendarSettings(
  selectedCalendarIds: string[],
): Promise<{ success: boolean }> {
  try {
    const settings: CalendarSettings = { selectedCalendarIds };
    await saveCalendarSettings(settings);
    return { success: true };
  } catch (error) {
    console.error("Error saving calendar settings:", error);
    return { success: false };
  }
}

export async function getSelectedCalendars(): Promise<string[]> {
  try {
    const settings = await getCalendarSettings();
    return settings.selectedCalendarIds;
  } catch (error) {
    console.error("Error getting calendar settings:", error);
    return [];
  }
}

export async function forceSyncCalendars(): Promise<{ success: boolean }> {
  try {
    await syncCalendars(true);
    return { success: true };
  } catch (error) {
    console.error("Error syncing calendars:", error);
    return { success: false };
  }
}

export async function updateCalendarEventTimes(
  eventId: string,
  start: number,
  end: number,
): Promise<{ success: boolean }> {
  try {
    await saveEventOverride({ eventId, start, end });
    return { success: true };
  } catch (error) {
    console.error("Error saving calendar event override:", error);
    return { success: false };
  }
}

export async function updateCalendarEventIncluded(
  eventId: string,
  included: boolean,
): Promise<{ success: boolean }> {
  try {
    const data = await loadEventOverrides();
    const existing = data.overrides[eventId];
    await saveEventOverride({
      eventId,
      start: existing?.start,
      end: existing?.end,
      included,
    });
    return { success: true };
  } catch (error) {
    console.error("Error saving calendar event included override:", error);
    return { success: false };
  }
}

export async function resetCalendarEventOverride(
  eventId: string,
): Promise<{ success: boolean }> {
  try {
    await deleteEventOverride(eventId);
    return { success: true };
  } catch (error) {
    console.error("Error deleting calendar event override:", error);
    return { success: false };
  }
}

export async function getEventOverrideIds(): Promise<string[]> {
  try {
    const data = await loadEventOverrides();
    return Object.keys(data.overrides);
  } catch {
    return [];
  }
}

export async function checkGoogleAuth(): Promise<{
  authenticated: boolean;
  email?: string;
}> {
  try {
    const authenticated = await isAuthenticated();
    if (authenticated) {
      const authData = await loadAuthTokens();
      return { authenticated: true, email: authData?.userEmail };
    }
    return { authenticated: false };
  } catch (error) {
    console.error("Error checking auth:", error);
    return { authenticated: false };
  }
}
