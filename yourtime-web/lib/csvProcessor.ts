import Papa from "papaparse";

export interface RawEvent {
  timestamp: number;
  appName: string;
  details: string;
  domain?: string;
}

export interface ProcessedEvent {
  appName: string;
  details: string;
  domain?: string;
  startTime: number;
  endTime: number;
  duration: number; // in seconds
}

export interface EventFragment {
  appName: string;
  details: string;
  domain?: string;
  duration: number; // seconds in this slot
}

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
  attentionScore?: {
    percentage: number;
    meetingRelatedSeconds: number;
    totalSeconds: number;
  };
}

export interface SlotData {
  slotStart: number;
  slotEnd: number;
  fragments: EventFragment[];
  calendarEvents?: CalendarEvent[];
}

export function parseCSV(file: File): Promise<RawEvent[]> {
  return new Promise((resolve, reject) => {
    Papa.parse(file, {
      skipEmptyLines: true,
      complete: (results) => {
        const rawEvents: RawEvent[] = [];
        const data = results.data as string[][];

        // Check if first row is header
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

            const timestamp = new Date(dateStr).getTime();
            if (!isNaN(timestamp)) {
              rawEvents.push({ timestamp, appName, details, domain });
            }
          }
        }

        // Sort by timestamp just in case
        rawEvents.sort((a, b) => a.timestamp - b.timestamp);
        resolve(rawEvents);
      },
      error: (error) => {
        reject(error);
      },
    });
  });
}

export function processEvents(rawEvents: RawEvent[]): ProcessedEvent[] {
  const result: ProcessedEvent[] = [];

  for (let i = 0; i < rawEvents.length - 1; i++) {
    const current = rawEvents[i];
    const next = rawEvents[i + 1];
    const duration = (next.timestamp - current.timestamp) / 1000;

    if (duration < 10) {
      // Discard this event and add time to the previous event if it exists
      if (result.length > 0) {
        const prev = result[result.length - 1];
        prev.endTime = next.timestamp;
        prev.duration = (prev.endTime - prev.startTime) / 1000;
      }
    } else {
      // Keep it
      result.push({
        appName: current.appName,
        details: current.details,
        domain: current.domain,
        startTime: current.timestamp,
        endTime: next.timestamp,
        duration: duration,
      });
    }
  }

  if (rawEvents.length > 0) {
    const last = rawEvents[rawEvents.length - 1];
    if (
      rawEvents.length === 1 ||
      result.length === 0 ||
      result[result.length - 1].startTime !== last.timestamp
    ) {
      result.push({
        appName: last.appName,
        details: last.details,
        domain: last.domain,
        startTime: last.timestamp,
        endTime: last.timestamp + 60 * 1000,
        duration: 60,
      });
    }
  }

  return result;
}

export function aggregateIntoSlots(
  events: ProcessedEvent[],
  granularitySeconds: number,
): SlotData[] {
  if (events.length === 0) return [];

  const firstTime = events[0].startTime;
  const lastTime = events[events.length - 1].endTime;

  const alignTo = granularitySeconds * 1000;
  const startSlotTime = Math.floor(firstTime / alignTo) * alignTo;
  const endSlotTime = Math.ceil(lastTime / alignTo) * alignTo;

  const slots: SlotData[] = [];

  for (let time = startSlotTime; time < endSlotTime; time += alignTo) {
    const slotStart = time;
    const slotEnd = time + alignTo;

    const fragments: EventFragment[] = [];

    for (const ev of events) {
      if (ev.endTime > slotStart && ev.startTime < slotEnd) {
        const overlapStart = Math.max(ev.startTime, slotStart);
        const overlapEnd = Math.min(ev.endTime, slotEnd);
        const overlapDuration = (overlapEnd - overlapStart) / 1000;

        if (overlapDuration > 0) {
          fragments.push({
            appName: ev.appName,
            details: ev.details,
            domain: ev.domain,
            duration: overlapDuration,
          });
        }
      }
    }

    slots.push({
      slotStart,
      slotEnd,
      fragments,
    });
  }

  return slots;
}
