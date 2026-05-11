import { CalendarEvent, SlotData, EventFragment } from "./csvProcessor";
import { SettingsData } from "./settings";

export interface AttentionScoreBreakdown {
  appName: string;
  domain?: string;
  seconds: number;
  isMeetingRelated: boolean;
}

export interface AttentionScore {
  percentage: number;
  meetingRelatedSeconds: number;
  totalSeconds: number;
  breakdown: AttentionScoreBreakdown[];
}

function isFragmentMeetingRelated(
  fragment: EventFragment,
  settings: SettingsData,
): boolean {
  // If domain is present, check domain first
  if (fragment.domain) {
    return settings.meetingRelatedDomains.includes(fragment.domain);
  }

  // Only check app if no domain is available
  if (settings.meetingRelatedApps.includes(fragment.appName)) {
    return true;
  }

  return false;
}

export function calculateMeetingAttentionScore(
  calendarEvent: CalendarEvent,
  slots: SlotData[],
  settings: SettingsData,
): AttentionScore | null {
  const meetingStart = calendarEvent.start;
  const meetingEnd = calendarEvent.end;

  const overlappingSlots = slots.filter(
    (slot) => slot.slotEnd > meetingStart && slot.slotStart < meetingEnd,
  );

  if (overlappingSlots.length === 0) {
    return null;
  }

  const breakdown: AttentionScoreBreakdown[] = [];
  let totalSeconds = 0;
  let meetingRelatedSeconds = 0;

  for (const slot of overlappingSlots) {
    const overlapStart = Math.max(slot.slotStart, meetingStart);
    const overlapEnd = Math.min(slot.slotEnd, meetingEnd);
    const overlapDuration = (overlapEnd - overlapStart) / 1000;

    for (const fragment of slot.fragments) {
      const fragmentDurationInSlot = Math.min(
        fragment.duration,
        overlapDuration,
      );

      const isMeetingRelated = isFragmentMeetingRelated(fragment, settings);

      const existingBreakdown = breakdown.find(
        (b) => b.appName === fragment.appName && b.domain === fragment.domain,
      );

      if (existingBreakdown) {
        existingBreakdown.seconds += fragmentDurationInSlot;
      } else {
        breakdown.push({
          appName: fragment.appName,
          domain: fragment.domain,
          seconds: fragmentDurationInSlot,
          isMeetingRelated,
        });
      }

      totalSeconds += fragmentDurationInSlot;
      if (isMeetingRelated) {
        meetingRelatedSeconds += fragmentDurationInSlot;
      }
    }
  }

  if (totalSeconds === 0) {
    return {
      percentage: 0,
      meetingRelatedSeconds: 0,
      totalSeconds: 0,
      breakdown: [],
    };
  }

  const percentage = (meetingRelatedSeconds / totalSeconds) * 100;

  breakdown.sort((a, b) => b.seconds - a.seconds);

  return {
    percentage,
    meetingRelatedSeconds,
    totalSeconds,
    breakdown,
  };
}

export function formatSeconds(seconds: number): string {
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = Math.floor(seconds % 60);

  if (minutes === 0) {
    return `${remainingSeconds}s`;
  }

  if (remainingSeconds === 0) {
    return `${minutes} min`;
  }

  return `${minutes} min ${remainingSeconds}s`;
}
