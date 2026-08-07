# Virtru Demo Center

Self-contained Electron app for demonstrating the Virtru Data Security Platform. No VM, no external dependencies — everything runs locally.

## Requirements

- Mac with Apple Silicon (M1 or later)
- macOS 12 Monterey or later

## Installation

**1. Download the DMG**

Go to the [latest release](https://github.com/smaxhart/virtru-demo-center/releases/latest) and download `virtru-demo-center-<version>-arm64.dmg`.

**2. Open the DMG and drag to Applications**

Open the downloaded `.dmg` file, then drag **Virtru Demo Center** into your `~/Applications` folder (your personal Applications folder, not `/Applications/`). Create the folder if it doesn't exist yet.

**3. Bypass Gatekeeper on first launch**

Because the app is not notarized, macOS may show a **"damaged and can't be opened"** error. To fix it, open Terminal and run:

```
xattr -cr ~/Applications/Virtru\ Demo\ Center.app
```

Then double-click the app to launch it normally. You only need to do this once.

## First Launch

The embedded OpenTDF platform starts automatically on launch — allow 10–15 seconds for it to initialize. A green dot appears next to the logo in the sidebar when the platform is ready.

## Updates

The app checks for updates automatically on launch. When a new version is available it downloads in the background and installs on next quit.

## Pages

All pages can be shown or hidden from **Dev → Settings** (available when the Generic persona is selected). Use this to tailor the demo for a specific audience or presentation context.

| Page | Description |
|---|---|
| Home | Overview and capability cards |
| Architecture | System diagram — Client, KAS, Platform, IdP, TDF |
| COP | Common Operating Picture — interactive map with real-time policy enforcement |
| Collaborate | Multi-persona document access control demo |
| AI Protection | Attribute-based filtering for AI agent personas |
| TDF Explorer | Encrypt/decrypt files, inspect TDF manifests |
| Key Management | DEK, KEK, and key wrapping explainer |
| Live Revocation | Real-time access revocation demo |
| Auto-Tagging | Document classification banner parsing + attribute extraction |
| Audit Log | Tamper-evident access event log |
| Encrypt / Decrypt | Step-by-step encryption workflow |
| Policy Builder | Visual attribute-based policy constructor |
| Platform | JWT tokens + OpenTDF Policy Engine connection status |

## Logs

If something isn't working, logs are at:

```
~/Library/Logs/virtru-demo-center/main.log
```
