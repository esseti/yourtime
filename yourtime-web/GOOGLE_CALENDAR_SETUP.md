# Google Calendar Integration - Setup Guide

## Prerequisiti

1. Account Google
2. Accesso a Google Cloud Console

## Step 1: Configurare Google Cloud Project

1. Vai su [Google Cloud Console](https://console.cloud.google.com/)
2. Crea un nuovo progetto o seleziona uno esistente
3. Abilita le API necessarie:
   - Google Calendar API
   - Google OAuth2 API

### Abilitare le API

1. Nel menu laterale, vai su **APIs & Services** > **Library**
2. Cerca "Google Calendar API" e clicca su **Enable**
3. Cerca "Google OAuth2 API" e clicca su **Enable**

## Step 2: Creare Credenziali OAuth 2.0

1. Nel menu laterale, vai su **APIs & Services** > **Credentials**
2. Clicca su **Create Credentials** > **OAuth client ID**
3. Se richiesto, configura la schermata di consenso OAuth:
   - User Type: **External**
   - App name: `YourTime Calendar Integration`
   - User support email: il tuo email
   - Developer contact: il tuo email
   - Scopes: aggiungi `calendar.readonly` e `userinfo.email`
4. Torna a **Credentials** e crea OAuth client ID:
   - Application type: **Web application**
   - Name: `YourTime Web Client`
   - Authorized redirect URIs: `http://localhost:3000/api/auth/google/callback`
   - Per produzione, aggiungi anche: `https://tuodominio.com/api/auth/google/callback`

5. Copia **Client ID** e **Client Secret**

## Step 3: Configurare Variabili d'Ambiente

1. Copia il file `.env.local.example` in `.env.local`:
   ```bash
   cp .env.local.example .env.local
   ```

2. Modifica `.env.local` e inserisci le tue credenziali:
   ```env
   GOOGLE_CLIENT_ID=il_tuo_client_id
   GOOGLE_CLIENT_SECRET=il_tuo_client_secret
   GOOGLE_REDIRECT_URI=http://localhost:3000/api/auth/google/callback
   ```

## Step 4: Installare Dipendenze

```bash
pnpm install
# oppure
npm install
```

## Step 5: Avviare l'Applicazione

```bash
pnpm dev
# oppure
npm run dev
```

## Step 6: Connettere Google Calendar

1. Apri l'applicazione su `http://localhost:3000`
2. Vai su **Impostazioni** > **Calendario**
3. Clicca su **Connetti Google Calendar**
4. Autorizza l'applicazione ad accedere al tuo calendario
5. Seleziona i calendari che vuoi sincronizzare
6. Clicca su **Salva Impostazioni**
7. Clicca su **Sincronizza Ora** per scaricare gli eventi

## Come Funziona

### Sincronizzazione Automatica

- Gli eventi vengono sincronizzati automaticamente per:
  - La data corrente (oggi)
  - Gli ultimi 7 giorni
- La sincronizzazione avviene ogni 24 ore

### Visualizzazione nella Timeline

- Quando visualizzi una giornata, gli slot con meeting mostrano:
  - **Border destro colorato** con il colore del calendario
  - **Tooltip al hover** sull'orario con:
    - Titolo evento
    - Orario inizio/fine
    - Descrizione (se presente)
    - Partecipanti (se presenti)
    - Link meeting (se presente)

### Dati Salvati

I dati vengono salvati localmente in:
- `data/google-auth.json` - Token di autenticazione
- `data/calendar-events.json` - Eventi sincronizzati
- `data/calendar-settings.json` - Calendari selezionati

## Sicurezza

- I token OAuth sono salvati solo localmente nel server
- Non vengono mai esposti al client
- I token vengono automaticamente rinnovati quando scadono
- Puoi disconnettere l'account in qualsiasi momento dalle impostazioni

## Troubleshooting

### Errore: "Google OAuth credentials not configured"

Assicurati che il file `.env.local` esista e contenga le credenziali corrette.

### Errore: "redirect_uri_mismatch"

Verifica che l'URI di redirect in Google Cloud Console corrisponda esattamente a quello in `.env.local`.

### Eventi non sincronizzati

1. Vai su **Impostazioni** > **Calendario**
2. Verifica che i calendari siano selezionati
3. Clicca su **Sincronizza Ora**
4. Controlla la console per eventuali errori

### Token scaduto

L'applicazione rinnova automaticamente i token. Se riscontri problemi:
1. Disconnetti l'account
2. Riconnetti nuovamente
