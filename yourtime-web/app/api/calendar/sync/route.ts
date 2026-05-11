import { NextResponse } from 'next/server';
import { syncCalendars } from '@/lib/calendarSync';

export async function POST() {
  try {
    const data = await syncCalendars(true);
    return NextResponse.json({ success: true, data });
  } catch (error) {
    console.error('Error syncing calendars:', error);
    return NextResponse.json(
      { error: 'Failed to sync calendars' },
      { status: 500 }
    );
  }
}
