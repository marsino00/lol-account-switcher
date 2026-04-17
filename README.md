# ⚔️ LoL Account Switcher

A lightweight desktop app for switching between multiple League of Legends accounts instantly — no passwords stored, no keystrokes simulated.

Built with [Tauri](https://tauri.app/) (Rust + React + TypeScript).

## How it works

The app saves your Riot Client session files locally when you log in with "Stay signed in" enabled. To switch accounts, it swaps those session files and launches League — no need to type credentials again.

- **No passwords stored** — only Riot's own session tokens (the same ones "Stay signed in" creates)
- **No keyboard automation** — no simulated keystrokes, no interaction with the Riot Client UI
- **No API abuse** — doesn't use any Riot API or inject anything into game processes
- **Lightweight** — ~5 MB installer, minimal RAM usage

## Installation

1. Download the latest `.exe` installer from [Releases](https://github.com/marsino00/lol-account-switcher/releases)
2. Run the installer (Windows may show a SmartScreen warning — click "More info" → "Run anyway")
3. Open **LoL Switcher** and select your Riot Client folder (usually `C:\Riot Games\Riot Client`)

## Usage

### Adding accounts

1. Click **"+ Add account"**
2. Enter a profile name (e.g., `main`, `smurf`, `tryhard`)
3. Click **"Open Riot Client"** — the Riot Client will open with a clean session
4. Log in with your account and **check "Stay signed in"**
5. Once you're in the League client, close everything and click **"Save profile"**

Repeat for each account.

### Switching accounts

Click the **▶ PLAY** button on any profile card. The app will:

1. Close any running Riot/League processes
2. Swap the session files for the selected account
3. Launch League of Legends

### Reference profile

If one of your accounts launches League directly (skipping the Riot Client launcher), you can set it as the **reference profile** by clicking the ☆ icon. Other profiles will inherit its config files to replicate the same behavior.

## Tech Stack

- **Frontend**: React + TypeScript
- **Backend**: Rust (Tauri)
- **Packaging**: Tauri bundler (NSIS installer)

## Building from source

### Prerequisites

- [Node.js](https://nodejs.org/) (v18+)
- [Rust](https://rustup.rs/)
- [Visual Studio Build Tools 2022](https://visualstudio.microsoft.com/visual-cpp-build-tools/) with C++ workload

### Steps

```bash
git clone https://github.com/marsino00/lol-account-switcher.git
cd lol-account-switcher
npm install
npm run tauri dev      # development
npm run tauri build    # production build
```

The installer will be in `src-tauri/target/release/bundle/nsis/`.

## Disclaimer

This project is not affiliated with or endorsed by Riot Games. Use at your own risk. The app only copies local configuration files and does not modify any game files, inject code, or interact with Riot's anti-cheat (Vanguard).

## License

MIT
