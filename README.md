<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
</div>

# PiPlate

Minimalist recipe manager for Android, Raspberry Pi, and Windows. The Android version is an installable Progressive Web App (PWA); the desktop version is packaged with Electron.

## Run Locally

Prerequisites: Node.js

1. Install dependencies:
   `npm install`
2. Optional local development only: create `.env.local` and set `VITE_GEMINI_API_KEY=your_key_here` to enable automatic AI recipe details and artwork. Electron also accepts `GEMINI_API_KEY` or `API_KEY` from the system environment. Never use this in the public GitHub Pages build.
3. Start the app:
   `npm run start`

## Install on a Samsung Galaxy S24

PiPlate must be served over HTTPS to be installable and to receive remote patches. The included GitHub Actions workflow publishes the `dist` folder to GitHub Pages.

1. Put this project in a GitHub repository whose default branch is `main`.
2. In the repository, open **Settings → Pages** and choose **GitHub Actions** as the source.
3. Push to `main`, then wait for the **Deploy PiPlate PWA** action to finish.
4. Open the Pages URL on the S24 in Chrome or Samsung Internet.
5. In PiPlate, open **Settings → Install on this device → Install app**. If the button is not shown yet, use the browser menu and choose **Install app** or **Add page to → Home screen**.

The installed app works offline after its first successful load. Recipes and the weekly plan remain in the phone's local browser database.

## Publish a Remote Patch

1. Make the code change on any computer or in GitHub's web editor.
2. Commit and push it to `main` (or run the workflow manually from the repository's **Actions** page).
3. GitHub Pages publishes a content-versioned release. PiPlate checks on launch and every 15 minutes while open.
4. When **A PiPlate patch is ready** appears on the S24, tap **Update**. The app shell reloads; recipes and planner data are not replaced.

Run `npm run build` locally to produce the same installable site in `dist`. That folder can also be hosted on any static HTTPS provider.

## ChatGPT Picture Connector

The public PWA uses a key-free ChatGPT handoff. When you tap **Create with ChatGPT**, PiPlate prepares a watercolor prompt from the recipe and opens the phone share sheet (or copies the prompt and opens ChatGPT). The prompt is sent only after that tap. Save the generated picture, return to PiPlate, and choose **Change picture**.

This connector stores no OpenAI API key, ChatGPT login, account identifier, or prompt in the repository. ChatGPT Plus can be used inside ChatGPT; it does not include OpenAI API usage. Fully automatic generation would require separate API billing and a server-side proxy.

> Never put any AI-provider key in a public Pages build. Variables beginning with `VITE_` are compiled into browser code. Keep `.env` files local and use a secure backend for any automatic API integration.

## Build a Windows Executable

1. Install dependencies:
   `npm install`
2. Create the executable:
   `npm run make:exe`

Artifacts are written to the `release` folder:

- `PiPlate-<version>-x64.exe` for the NSIS installer
- `PiPlate-<version>-x64-portable.exe` for the portable build

You can also use the included PowerShell helper:

`.\build-windows.ps1`
