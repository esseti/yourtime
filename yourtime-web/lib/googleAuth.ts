import { google } from "googleapis";
import fs from "fs/promises";
import path from "path";

const DATA_DIR = path.join(process.cwd(), "data");
const AUTH_FILE = path.join(DATA_DIR, "google-auth.json");

export interface GoogleAuthTokens {
  access_token: string;
  refresh_token?: string;
  expiry_date?: number;
  scope?: string;
  token_type?: string;
}

export interface GoogleAuthData {
  tokens: GoogleAuthTokens;
  userEmail?: string;
}

export function getOAuth2Client() {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  const redirectUri =
    process.env.GOOGLE_REDIRECT_URI ||
    "http://localhost:3000/api/auth/google/callback";

  if (!clientId || !clientSecret) {
    throw new Error(
      "Google OAuth credentials not configured. Please set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET in .env.local",
    );
  }

  return new google.auth.OAuth2(clientId, clientSecret, redirectUri);
}

export function getAuthUrl(): string {
  const oauth2Client = getOAuth2Client();

  const scopes = [
    "https://www.googleapis.com/auth/calendar.readonly",
    "https://www.googleapis.com/auth/userinfo.email",
  ];

  return oauth2Client.generateAuthUrl({
    access_type: "offline",
    scope: scopes,
    prompt: "consent",
  });
}

export async function saveAuthTokens(
  tokens: GoogleAuthTokens,
  userEmail?: string,
): Promise<void> {
  try {
    await fs.access(DATA_DIR);
  } catch {
    await fs.mkdir(DATA_DIR, { recursive: true });
  }

  const authData: GoogleAuthData = {
    tokens,
    userEmail,
  };

  await fs.writeFile(AUTH_FILE, JSON.stringify(authData, null, 2));
}

export async function loadAuthTokens(): Promise<GoogleAuthData | null> {
  try {
    const content = await fs.readFile(AUTH_FILE, "utf-8");
    return JSON.parse(content);
  } catch {
    return null;
  }
}

export async function deleteAuthTokens(): Promise<void> {
  try {
    await fs.unlink(AUTH_FILE);
  } catch {
    // File doesn't exist, that's fine
  }
}

export async function getAuthenticatedClient() {
  const authData = await loadAuthTokens();
  if (!authData) {
    return null;
  }

  const oauth2Client = getOAuth2Client();
  oauth2Client.setCredentials(authData.tokens);

  if (authData.tokens.expiry_date && authData.tokens.expiry_date < Date.now()) {
    try {
      const { credentials } = await oauth2Client.refreshAccessToken();
      if (!credentials.access_token) {
        console.error("Refresh token did not return access_token");
        return null;
      }
      await saveAuthTokens(credentials as GoogleAuthTokens, authData.userEmail);
      oauth2Client.setCredentials(credentials);
    } catch (error) {
      console.error("Failed to refresh token:", error);
      return null;
    }
  }

  return oauth2Client;
}

export async function isAuthenticated(): Promise<boolean> {
  const authData = await loadAuthTokens();
  return authData !== null;
}
