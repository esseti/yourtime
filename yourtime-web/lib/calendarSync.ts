import { google } from "googleapis";
import fs from "fs/promises";
import path from "path";
import { getAuthenticatedClient } from "./googleAuth";

const DATA_DIR = path.join(process.cwd(), "data");
const CALENDAR_EVENTS_FILE = path.join(DATA_DIR, "calendar-events.json");
const CALENDAR_SETTINGS_FILE = path.join(DATA_DIR, "calendar-settings.json");
const CALENDAR_OVERRIDES_FILE = path.join(
  DATA_DIR,
  "calendar-event-overrides.json",
);

export interface CalendarEvent {
  id: string;
  calendarId: string;
  calendarColor: string;
  title: string;
  description?: string;
  start: number;
  end: number;
  attendees?: string[];
  meetingLink?: string;
  responseStatus?: string;
  included?: boolean;
}

export interface CalendarEventsData {
  lastSync: number;
  events: CalendarEvent[];
}

export interface CalendarInfo {
  id: string;
  summary: string;
  backgroundColor: string;
  selected: boolean;
}

export interface CalendarSettings {
  selectedCalendarIds: string[];
}

export interface CalendarEventOverride {
  eventId: string;
  start?: number;
  end?: number;
  included?: boolean;
}

export interface CalendarEventOverridesData {
  overrides: Record<string, CalendarEventOverride>;
}

async function ensureDataDir() {
  try {
    await fs.access(DATA_DIR);
  } catch {
    await fs.mkdir(DATA_DIR, { recursive: true });
  }
}

export async function loadEventOverrides(): Promise<CalendarEventOverridesData> {
  await ensureDataDir();
  try {
    const content = await fs.readFile(CALENDAR_OVERRIDES_FILE, "utf-8");
    return JSON.parse(content);
  } catch {
    return { overrides: {} };
  }
}

export async function saveEventOverride(
  override: CalendarEventOverride,
): Promise<void> {
  const data = await loadEventOverrides();
  data.overrides[override.eventId] = override;
  await ensureDataDir();
  await fs.writeFile(CALENDAR_OVERRIDES_FILE, JSON.stringify(data, null, 2));
}

export async function deleteEventOverride(eventId: string): Promise<void> {
  const data = await loadEventOverrides();
  delete data.overrides[eventId];
  await ensureDataDir();
  await fs.writeFile(CALENDAR_OVERRIDES_FILE, JSON.stringify(data, null, 2));
}

function applyOverrides(
  events: CalendarEvent[],
  overrides: CalendarEventOverridesData,
): CalendarEvent[] {
  return events.map((event) => {
    const defaultIncluded = event.responseStatus === "accepted";
    const override = overrides.overrides[event.id];
    if (override) {
      return {
        ...event,
        start: override.start ?? event.start,
        end: override.end ?? event.end,
        included: override.included ?? defaultIncluded,
      };
    }
    return { ...event, included: defaultIncluded };
  });
}

export async function getAvailableCalendars(): Promise<CalendarInfo[]> {
  const oauth2Client = await getAuthenticatedClient();
  if (!oauth2Client) {
    throw new Error("Not authenticated");
  }

  const calendar = google.calendar({ version: "v3", auth: oauth2Client });
  const response = await calendar.calendarList.list();

  const settings = await getCalendarSettings();

  return (response.data.items || []).map((cal) => ({
    id: cal.id || "",
    summary: cal.summary || "Unnamed Calendar",
    backgroundColor: cal.backgroundColor || "#9E69AF",
    selected: settings.selectedCalendarIds.includes(cal.id || ""),
  }));
}

export async function getCalendarSettings(): Promise<CalendarSettings> {
  await ensureDataDir();
  try {
    const content = await fs.readFile(CALENDAR_SETTINGS_FILE, "utf-8");
    return JSON.parse(content);
  } catch {
    return { selectedCalendarIds: [] };
  }
}

export async function saveCalendarSettings(
  settings: CalendarSettings,
): Promise<void> {
  await ensureDataDir();
  await fs.writeFile(CALENDAR_SETTINGS_FILE, JSON.stringify(settings, null, 2));
}

export async function loadCalendarEvents(): Promise<CalendarEventsData | null> {
  try {
    const content = await fs.readFile(CALENDAR_EVENTS_FILE, "utf-8");
    return JSON.parse(content);
  } catch {
    return null;
  }
}

async function saveCalendarEvents(data: CalendarEventsData): Promise<void> {
  await ensureDataDir();
  await fs.writeFile(CALENDAR_EVENTS_FILE, JSON.stringify(data, null, 2));
}

function shouldResync(lastSync: number, targetDate: string): boolean {
  const now = new Date();
  const oneWeekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const target = new Date(targetDate);

  if (target >= oneWeekAgo && target <= now) {
    return true;
  }

  const hoursSinceLastSync = (Date.now() - lastSync) / (1000 * 60 * 60);
  return hoursSinceLastSync > 24;
}

export async function syncCalendars(
  forceSync: boolean = false,
): Promise<CalendarEventsData> {
  const oauth2Client = await getAuthenticatedClient();
  if (!oauth2Client) {
    throw new Error("Not authenticated");
  }

  const existingData = await loadCalendarEvents();

  if (!forceSync && existingData) {
    const hoursSinceLastSync =
      (Date.now() - existingData.lastSync) / (1000 * 60 * 60);
    if (hoursSinceLastSync < 1) {
      return existingData;
    }
  }

  const settings = await getCalendarSettings();
  if (settings.selectedCalendarIds.length === 0) {
    const emptyData: CalendarEventsData = {
      lastSync: Date.now(),
      events: [],
    };
    await saveCalendarEvents(emptyData);
    return emptyData;
  }

  const calendar = google.calendar({ version: "v3", auth: oauth2Client });
  const allEvents: CalendarEvent[] = [];

  const now = new Date();
  const oneWeekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const oneMonthAhead = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

  for (const calendarId of settings.selectedCalendarIds) {
    try {
      const calendarInfo = await calendar.calendarList.get({ calendarId });
      const backgroundColor = calendarInfo.data.backgroundColor || "#9E69AF";

      const response = await calendar.events.list({
        calendarId,
        timeMin: oneWeekAgo.toISOString(),
        timeMax: oneMonthAhead.toISOString(),
        singleEvents: true,
        orderBy: "startTime",
      });

      const events = response.data.items || [];

      for (const event of events) {
        if (!event.start || !event.end) continue;

        const userAttendee = event.attendees?.find(
          (attendee) => attendee.self === true,
        );
        const userResponseStatus = userAttendee?.responseStatus;

        const startTime = event.start.dateTime
          ? new Date(event.start.dateTime).getTime()
          : new Date(event.start.date!).getTime();

        const endTime = event.end.dateTime
          ? new Date(event.end.dateTime).getTime()
          : new Date(event.end.date!).getTime();

        const attendees =
          event.attendees?.map((a) => a.email || "").filter(Boolean) || [];
        const meetingLink =
          event.hangoutLink ||
          event.conferenceData?.entryPoints?.find(
            (ep) => ep.entryPointType === "video",
          )?.uri;

        const eventColorMap: Record<string, string> = {
          "1": "#a4bdfc",
          "2": "#7ae7bf",
          "3": "#dbadff",
          "4": "#ff887c",
          "5": "#fbd75b",
          "6": "#ffb878",
          "7": "#46d6db",
          "8": "#e1e1e1",
          "9": "#5484ed",
          "10": "#51b749",
          "11": "#dc2127",
        };

        const eventColor =
          event.colorId && eventColorMap[event.colorId]
            ? eventColorMap[event.colorId]
            : backgroundColor;

        allEvents.push({
          id: event.id || "",
          calendarId,
          calendarColor: eventColor,
          title: event.summary || "Untitled Event",
          description: event.description || undefined,
          start: startTime,
          end: endTime,
          attendees,
          meetingLink: meetingLink || undefined,
          responseStatus: userResponseStatus ?? undefined,
        });
      }
    } catch (error) {
      console.error(
        `Error fetching events from calendar ${calendarId}:`,
        error,
      );
    }
  }

  const data: CalendarEventsData = {
    lastSync: Date.now(),
    events: allEvents,
  };

  await saveCalendarEvents(data);
  return data;
}

export async function getCalendarEventsForDate(
  dateString: string,
): Promise<CalendarEvent[]> {
  const data = await loadCalendarEvents();
  if (!data) {
    return [];
  }

  const now = new Date();
  const oneWeekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const targetDate = new Date(dateString);

  let events: CalendarEvent[];
  if (targetDate >= oneWeekAgo && targetDate <= now) {
    if (shouldResync(data.lastSync, dateString)) {
      const freshData = await syncCalendars(false);
      events = filterEventsByDate(freshData.events, dateString);
    } else {
      events = filterEventsByDate(data.events, dateString);
    }
  } else {
    events = filterEventsByDate(data.events, dateString);
  }

  const overrides = await loadEventOverrides();
  return applyOverrides(events, overrides);
}

function filterEventsByDate(
  events: CalendarEvent[],
  dateString: string,
): CalendarEvent[] {
  const targetDate = new Date(dateString);
  const startOfDay = new Date(
    targetDate.getFullYear(),
    targetDate.getMonth(),
    targetDate.getDate(),
  ).getTime();
  const endOfDay = startOfDay + 24 * 60 * 60 * 1000;

  return events.filter((event) => {
    return event.start < endOfDay && event.end > startOfDay;
  });
}
