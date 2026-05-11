import { NextRequest, NextResponse } from "next/server";
import {
  getOAuth2Client,
  saveAuthTokens,
  GoogleAuthTokens,
} from "@/lib/googleAuth";
import { google } from "googleapis";

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const code = searchParams.get("code");
  const error = searchParams.get("error");

  if (error) {
    return NextResponse.redirect(
      new URL("/settings/calendar?error=access_denied", request.url),
    );
  }

  if (!code) {
    return NextResponse.redirect(
      new URL("/settings/calendar?error=no_code", request.url),
    );
  }

  try {
    const oauth2Client = getOAuth2Client();
    const { tokens } = await oauth2Client.getToken(code);

    if (!tokens.access_token) {
      return NextResponse.redirect(
        new URL("/settings/calendar?error=no_token", request.url),
      );
    }

    oauth2Client.setCredentials(tokens);

    const oauth2 = google.oauth2({ version: "v2", auth: oauth2Client });
    const userInfo = await oauth2.userinfo.get();
    const userEmail = userInfo.data.email || undefined;

    await saveAuthTokens(tokens as GoogleAuthTokens, userEmail);

    return NextResponse.redirect(
      new URL("/settings/calendar?success=true", request.url),
    );
  } catch (err) {
    console.error("Error during OAuth callback:", err);
    return NextResponse.redirect(
      new URL("/settings/calendar?error=auth_failed", request.url),
    );
  }
}
