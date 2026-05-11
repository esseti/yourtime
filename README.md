# YourTime

**Know where your time actually goes.**

YourTime is an open-source time tracking system for macOS. A lightweight menu-bar app silently captures every app, window, and browser tab you use. A self-hosted web dashboard turns that raw data into a scored, visual breakdown of your day — with no cloud, no account, and no telemetry.

→ **[yourtime website](https://esseti.github.io/yourtime)**

---

## How it works

1. **Mac app** — runs in the background and logs every window switch, browser URL, and idle moment to a daily CSV file at `~/.yourtime/data/YYYY-MM-DD.csv`
2. **Web dashboard** — mount that folder into Docker and get a minute-by-minute timeline, productivity score, and Google Calendar overlay

## Repository structure

```
yourtime-mac/   macOS menu-bar app (Swift)
yourtime-web/   Web dashboard (Next.js, self-hosted via Docker)
```

## Quick start

### Mac app

1. Download the latest `YourTime.zip` from [Releases](https://github.com/esseti/yourtime/releases/latest)
2. Unzip and move `YourTime.app` to `/Applications`
3. Right-click → **Open** (required on first launch — the build is unsigned)
4. Grant **Accessibility** permissions when prompted

### Web dashboard

```bash
docker pull ghcr.io/esseti/yourtime:latest

docker run -d --name yourtime \
  -v ~/.yourtime/data:/app/data \
  -p 8888:3000 \
  ghcr.io/esseti/yourtime:latest
```

Open [http://localhost:8888](http://localhost:8888).

Optional: add `-e GOOGLE_CLIENT_ID=... -e GOOGLE_CLIENT_SECRET=...` to enable Google Calendar sync. See [GOOGLE_CALENDAR_SETUP.md](yourtime-web/GOOGLE_CALENDAR_SETUP.md).

## Build from source

**Mac app** — open `yourtime-mac/YourTime/YourTime.xcodeproj` in Xcode and run.

**Web dashboard**
```bash
cd yourtime-web
pnpm install
cp .env.local.example .env.local   # add Google credentials if needed
pnpm dev
```

## Privacy

All data stays on your machine. The Mac app detects private/incognito browsing and never logs the actual URL. The web dashboard runs locally inside Docker.

## License

MIT
