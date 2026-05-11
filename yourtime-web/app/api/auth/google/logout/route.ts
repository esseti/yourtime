import { NextResponse } from 'next/server';
import { deleteAuthTokens, getAuthenticatedClient } from '@/lib/googleAuth';
import { google } from 'googleapis';

export async function POST() {
  try {
    const oauth2Client = await getAuthenticatedClient();

    if (oauth2Client) {
      try {
        await oauth2Client.revokeCredentials();
      } catch (error) {
        console.error('Error revoking credentials:', error);
      }
    }

    await deleteAuthTokens();

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error during logout:', error);
    return NextResponse.json(
      { error: 'Failed to logout' },
      { status: 500 }
    );
  }
}
