# Google Calendar Integration - Setup Guide

## Prerequisites

1. Google Account
2. Access to Google Cloud Console

## Step 1: Configure Google Cloud Project

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select an existing one
3. Enable the required APIs:
   - Google Calendar API
   - Google OAuth2 API

### Enable the APIs

1. In the side menu, go to **APIs & Services** > **Library**
2. Search for "Google Calendar API" and click **Enable**
3. Search for "Google OAuth2 API" and click **Enable**

## Step 2: Create OAuth 2.0 Credentials

1. In the side menu, go to **APIs & Services** > **Credentials**
2. Click **Create Credentials** > **OAuth client ID**
3. If prompted, configure the OAuth consent screen:
   - User Type: **External**
   - App name: `YourTime Calendar Integration`
   - User support email: your email
   - Developer contact: your email
   - Scopes: add `calendar.readonly` and `userinfo.email`
4. Go back to **Credentials** and create the OAuth client ID:
   - Application type: **Web application**
   - Name: `YourTime Web Client`
   - Authorized redirect URIs: `http://localhost:3000/api/auth/google/callback`
   - For production, also add: `https://yourdomain.com/api/auth/google/callback`

5. Copy the **Client ID** and **Client Secret**

## Step 3: Configure Environment Variables

1. Copy the `.env.local.example` file to `.env.local`:
   ```bash
   cp .env.local.example .env.local
   ```

2. Edit `.env.local` and fill in your credentials:
   ```env
   GOOGLE_CLIENT_ID=your_client_id
   GOOGLE_CLIENT_SECRET=your_client_secret
   GOOGLE_REDIRECT_URI=http://localhost:3000/api/auth/google/callback
   ```

## Step 4: Install Dependencies

```bash
pnpm install
# or
npm install
```

## Step 5: Start the Application

```bash
pnpm dev
# or
npm run dev
```

## Step 6: Connect Google Calendar

1. Open the application at `http://localhost:3000`
2. Go to **Settings** > **Calendar**
3. Click **Connect Google Calendar**
4. Authorize the application to access your calendar
5. Select the calendars you want to sync
6. Click **Save Settings**
7. Click **Sync Now** to download events

## How It Works

### Automatic Sync

- Events are automatically synced for:
  - The current date (today)
  - The last 7 days
- Sync runs every 24 hours

### Timeline View

- When viewing a day, slots with meetings show:
  - **Colored right border** matching the calendar color
  - **Hover tooltip** on the time slot with:
    - Event title
    - Start/end time
    - Description (if present)
    - Attendees (if present)
    - Meeting link (if present)

### Stored Data

Data is saved locally in:
- `data/google-auth.json` - Authentication tokens
- `data/calendar-events.json` - Synced events
- `data/calendar-settings.json` - Selected calendars

## Security

- OAuth tokens are stored only locally on the server
- They are never exposed to the client
- Tokens are automatically refreshed when they expire
- You can disconnect the account at any time from the settings

## Troubleshooting

### Error: "Google OAuth credentials not configured"

Make sure the `.env.local` file exists and contains the correct credentials.

### Error: "redirect_uri_mismatch"

Verify that the redirect URI in Google Cloud Console exactly matches the one in `.env.local`.

### Events not syncing

1. Go to **Settings** > **Calendar**
2. Verify that calendars are selected
3. Click **Sync Now**
4. Check the console for any errors

### Expired token

The application refreshes tokens automatically. If you encounter issues:
1. Disconnect the account
2. Reconnect again
