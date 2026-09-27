# Kurz / MashAI – Code-Analyse

> Stand: 27.09.2026 · Branch `arena/01a0e39c-kurz` · Basis-Commit `1c694e8`

Diese Datei erklärt die Architektur der App, dokumentiert die wichtigsten Datenflüsse
und listet die Befunde auf, die im Rahmen dieser Arbeit behoben wurden.

---

## 1. Was ist das Projekt?

**MashAI** (Reponame `Kurz`) ist ein Electron-Desktop-Browser, der mehrere
KI-Web-Assistenten (ChatGPT, Claude, Gemini, Perplexity, Grok, …) in einem Fenster
organisiert. Kernidee: statt vieler Browser-Tabs gibt es **Profile** (Arbeit, Privat,
Research) und darin **Tabs**, die jeweils auf einen KI-Provider zeigen.

Tech-Stack: Electron 39, React 18, TypeScript 5.9, Vite 6, Tailwind 3,
Ghostery-Adblocker.

---

## 2. Prozessmodell

```
┌──────────────────────────────────────────────────────────────┐
│ Hauptprozess (electron/main.ts, CommonJS, dist/electron)      │
│                                                              │
│  TabManager        Tab-Lebenszyklus, WebContentsViews,        │
│                    Lazy Loading, Suspension, Side Panel       │
│  SessionManager    Persistenz von Tabs/Window-State           │
│  SettingsManager   settings.json (Profile, Provider, …)       │
│  ProfileManager    Profilliste                                │
│  AdBlockManager    Ghostery-Engine, Filter-Listen, Cache      │
│  DownloadManager   Download-Historie + Toasts                 │
│  TrayManager       Tray, Global Shortcuts, Always-on-Top      │
│  MenuBuilder       App-Menü + native Kontextmenüs             │
│  QuickSearchManager  schwebendes Suchfenster (Ctrl+K)         │
│                                                              │
│  ipc/*Handlers     ipcMain.on/handle pro Domäne               │
└───────────┬──────────────────────────────┬───────────────────┘
            │ contextBridge (preload.ts)   │ loadFile
┌───────────▼──────────────┐   ┌───────────▼───────────────────┐
│ Renderer: React (src/)   │   │ Weitere Fenster               │
│  App.tsx        Haupt-UI │   │  #/settings → SettingsApp     │
│  TitleBar.tsx   Tab-Leiste│   │  #/downloads → DownloadsWindow│
│  SettingsModal           │   │  quick-search.html (vanilla)  │
└──────────────────────────┘   └───────────────────────────────┘
```

Wichtig: **Es gibt keine `<webview>`-Tags.** Jeder Tab ist ein `WebContentsView`,
das direkt als Child-View an `mainWindow.contentView` gehängt wird. Deshalb liegt der
Web-Inhalt **über** der React-Oberfläche – die React-Leiste ist nur im Bereich
`y < 36px` (Titlebar) sichtbar. Genau aus diesem Grund müssen Overlays im Renderer
vor dem Öffnen die Views entkoppeln (`hide-webview`/`show-webview`).

---

## 3. Tab-Lebenszyklus (das Herzstück)

Ein Tab existiert in zwei Zuständen:

| Zustand | Bedeutung | Speicher |
|---|---|---|
| `loaded: true` | hat ein `WebContentsView` | ja |
| `loaded: false` | nur Metadaten (id, url, title, profileId, favicon) | nein |

Ablauf:

1. **Erzeugen** – `createTab()` erzeugt sofort ein View (User-Aktion),
   `registerTabMetadata()` nur Metadaten (Session-Restore, „lazy").
2. **Aktivieren** – `switchTo(id)` lädt bei Bedarf via `loadTab()` nach und hängt
   das View an. Beim Verlassen wird `lastActiveTime` gesetzt.
3. **Suspendieren** – `unloadTab(id)` schließt das `webContents`, behält aber die
   Metadaten. Auslöser:
   * Inaktivitäts-Timer (alle 60 s, `autoSuspendMinutes`)
   * Profilwechsel (`profileSwitchBehavior: 'suspend'`)
   * Tray-Optimierung (`suspendOnHide` nach `suspendDelaySeconds`)
   * manuell über das Tab-Kontextmenü
   Geschützt sind: aktiver Tab, Tabs mit Audio/Video, Tabs mit
   „Never Suspend This Tab", optional der aktive Profil.
4. **Schließen** – `closeTab(id)` entfernt View + Metadaten.

`tabOrder: string[]` ist die **einzige Wahrheit für die Tab-Reihenfolge**
(Drag & Drop). `tabs` ist nur eine Map für den Zugriff per id.

### Side Panel

`sidePanelByProfile: Map<profileId, SidePanelState>` hält pro Profil genau einen
gepinnten Tab. `updateViewBounds()` (in `main.ts`) teilt dann das Fenster in
Hauptbereich + Panel auf (mit 4 px Divider). Beim Profilwechsel wird das View des
alten Profils entfernt und das des neuen eingehängt.

---

## 4. Session-Persistenz

`SessionManager.saveSession()` schreibt `session.json`:

* alle Tabs (id, profileId, url, title, favicon)
* `activeTabId`, `lastActiveProfileId`, `activeTabByProfile`
* Fenstergeometrie (nur wenn `general.rememberWindowPosition`)
* `sidePanelByProfile`

Beim Start liest `restoreSession()` die Datei und entscheidet anhand von
`performance.tabLoadingStrategy`, welche Tabs sofort ein View bekommen:

* `all` – alles
* `activeProfile` – nur Tabs des letzten aktiven Profils
* `lastActiveOnly` – nur den zuletzt aktiven Tab (Default, schnellster Start)

Nach 500 ms wird auf den aktiven Tab geschaltet und das Side Panel wiederhergestellt.

---

## 5. IPC-Kommunikation

* **Render → Main:** `ipcRenderer.send(...)` für Aktionen (`create-tab`,
  `switch-tab`, `close-tab`, `pin-to-side-panel`, …), `ipcRenderer.invoke(...)` für
  Abfragen (`get-settings`, `get-all-tabs`, `get-adblock-status`, …).
* **Main → Render:** `webContents.send('tab-created' | 'tab-updated' |
  'tab-loading' | 'tab-closed-backend' | 'side-panel-state-changed' | 'show-toast' |
  …)`.
* `preload.ts` ist die **einzige** erlaubte Brücke (`contextIsolation: true`,
  `nodeIntegration: false`). Jeder Listener dort gibt eine Cleanup-Funktion zurück,
  die React in `useEffect`-Aufräumen nutzt.

Achtung: `src/types/index.ts` beschreibt das `window.api`-Interface **gewünscht**,
nicht exakt. Ein paar Methoden dort haben keine Entsprechung im Preload
(z. B. `onMaximized`, `getProfileTabs` als Promise). Solche Lücken fallen nicht auf,
solange sie nicht benutzt werden – sind aber ein typischer Stolperstein.

---

## 6. AdBlocking

`AdBlockManager` lädt zehn EasyList-/uBlock-Listen, baut daraus ein
`ElectronBlocker` und aktiviert es pro Partition (`persist:<profileId>`).

* Serialisierter State → `adblock-cache.bin`, Metadaten → `adblock-metadata.json`
* Cache älter als 24 h → Hintergrund-Update
* Whitelist wird gegen den Hostnamen geprüft (inkl. Subdomains, case-insensitiv)
* Kosmetische Filter werden nach `did-finish-load` als CSS injiziert

---

## 7. Dateiübersicht

| Datei | Rolle |
|---|---|
| `electron/main.ts` | Fenster-Erzeugung, Verdrahtung aller Manager, Close-to-Tray |
| `electron/TabManager.ts` (ca. 1400 Z.) | Tab-Lebenszyklus, Views, Kontextmenü, Downloads, Popups |
| `electron/SessionManager.ts` | session.json, Restore-Strategien |
| `electron/SettingsManager.ts` | settings.json inkl. Migrationen |
| `electron/MenuBuilder.ts` | App-Menü + native Kontextmenüs |
| `electron/TrayManager.ts` | Tray, globale Shortcuts, Suspension bei Hide |
| `electron/AdBlockManager.ts` | Ghostery-Engine |
| `electron/QuickSearchManager.ts` | schwebendes Ctrl+K-Fenster |
| `electron/preload.ts` | contextBridge-API |
| `src/App.tsx` | Renderer-State (Tabs, Profile, Side Panel, Toasts) |
| `src/components/TitleBar.tsx` | Tab-Leiste inkl. Drag & Drop |
| `src/lib/*` | reine, testbare Logik (Tab-Suche, Formatierung) |
| `public/quick-search.html` | Ctrl+K-Fenster (vanilla JS) |

---

## 8. Gefundene und behobene Fehler

Alle Punkte sind in diesem Branch behoben; die Nummern tauchen in den
Commit-Messages wieder auf.

### 8.1 Tab blieb nach dem Wiederherstellen „suspended" markiert
`TabManager.loadTab()` setzte `loaded = true`, aber nie `suspended = false`, und das
`tab-updated`-Event enthielt kein `suspended`. Folge: Nach Auto-Suspend + Klick auf
den Tab blieb er in der Leiste ausgegraut und zeigte weiter „(suspended)" im Tooltip.
→ `loadTab()` setzt jetzt `suspended = false` und sendet es mit.

### 8.2 Ctrl+Tab / Ctrl+Shift+Tab ignorierten die Tab-Reihenfolge
`MenuBuilder` ermittelte die Nachbartabs über `Array.from(tabs.values())`, also in
Map-Einfügereihenfolge. Nach Drag & Drop (`reorderTabs`) stimmte die Reihenfolge
nicht mehr. → nutzt jetzt `getTabsForProfile()` (respektiert `tabOrder`).

### 8.3 Speicheranzeige zeigte KB mit „MB"-Label
Der Hauptprozess liefert `memoryKB` (echte KB), der Renderer hängte „MB" an – jedes
Tab-Tooltip war um den Faktor 1024 zu groß. → neue reine Funktion
`formatMemoryKB()` in `src/lib/format.ts`, Tooltip formatiert korrekt; irreführende
Kommentare im Hauptprozess korrigiert.

### 8.4 `switchTo()` konnte bei fehlendem View crashen
`addChildView(tab.view!)` wurde mit einem non-null-Assertion aufgerufen. Schlug die
View-Erzeugung fehl, war das ein „Object has been destroyed"-Absturz. → prüft jetzt
`tab.view` und gibt `false` zurück.

### 8.5 Doppeltes `addChildView` beim Anpinnen des einzigen Tabs
Wird der einzige Tab eines Profils angepinnt, gibt es keinen Ersatz-Tab, auf den
umgeschaltet werden könnte. Das View wurde dann ein zweites Mal an das Fenster
gehängt. → neue idempotente Helfer `_addView()`/`_removeView()` (prüfen
`contentView.children`), genutzt von allen View-Operationen.

### 8.6 AdBlock-Update erzeugte Phantom-Sessions
`updateLists()` iterierte über `enabledSessions`, das auch interne
`persist:<id>:events`-Bookkeeping-Einträge enthält, und rief dafür
`session.fromPartition()` auf. → diese Einträge werden übersprungen.

### 8.7 TrayManager räumte nicht vollständig auf
`destroy()` gab nur den Hide-Shortcut frei; der Always-on-Top-Shortcut blieb
registriert und ein pendierter Suspend-Timer konnte Tabs noch während des Quitens
entladen. → beides wird aufgeräumt.

### 8.8 `MAX_CLOSED_TABS` war toter Code
Die Konstante war importiert, aber nie genutzt – stattdessen stand eine harte `10`
im Handler. → Handler nutzt die Konstante.

### 8.9 Download-Fenster wurde nie auto-geöffnet
`TabManager.setOpenDownloadsWindow()` wurde nirgends aufgerufen, der Aufruf im
Download-Handler war damit toter Code. → in `main.ts` mit `createDownloadsWindow`
verdrahtet.

### 8.10 `hide-webview` / `show-webview` ohne Handler
Beide Channels waren im Preload exponiert, aber es gab kein `ipcMain.on(...)`.
Jeder Aufruf (z. B. aus `NewTabPopover`) verpuffte. → Handler registriert und
`hideAllViews()`/`showAllViews()` im TabManager ergänzt (Active + Pinned View).

### 8.11 Shortcut-Validator lehnte eigene Presets ab
`isValidShortcut()` verlangte grundsätzlich einen Modifier – das Brave-Preset
(`F5`) war damit nicht speicherbar. Zudem akzeptierte `F\d{1,2}` `F13`, obwohl
Electron nur F1–F12 kennt. → Bare Function-/Special-Keys sind erlaubt, F13+ wird
abgelehnt (durch Tests abgedeckt).

### 8.12 Kosmetisch
* Quick-Search-Fenster wurde mit 700×130 erzeugt, aber beim Anzeigen auf 600×120
  gesetzt → einheitliche Konstanten.
* `App.tsx` überschrieb die von Main geschickte URL eines neuen Tabs mit `''`
  (Provider-Farbe/Favicon erst später korrekt).

---

## 9. Offene Punkte / Empfehlungen

Keine der folgenden Punkte ist ein Absturz, aber sie kosten Wartungszeit:

1. **Toter Code:** `NewTabPopover.tsx` wird nirgends eingebunden;
   `TabManager.hideActiveView/showActiveView`, `getActiveTabId()`, die Konstanten
   `IPC_EVENTS`, `PERFORMANCE_DEFAULTS`, `GENERAL_DEFAULTS`,
   `SESSION_RESTORE_DELAY_MS` (electron) sowie `src/constants/index.ts` sind ungenutzt.
   `electron/types/index.ts` und `src/types/index.ts` sind nahezu identische
   Duplikate – eine gemeinsame `types.ts` würde Doppelfehler vermeiden.
2. **Keine Tests für den Hauptprozess:** `TabManager`, `SessionManager`,
   `TrayManager` brauchen Electron-Mocks. Die reine Logik ist inzwischen getestet
   (siehe `npm test`); für die Manager wäre ein kleiner IPC-Mock-Helfer der
   nächste Schritt.
3. **`loadSettings()` merged nur flach:** Verschachtelte Objekte (z. B. `general`)
   werden komplett ersetzt, nicht gemergt. Solange der Renderer immer das volle
   Settings-Objekt schickt, ist das unkritisch.
4. **Sichtbarkeit von Overlays:** Alles, was im Renderer über dem Web-Inhalt liegen
   muss, braucht `hide-webview`. Ein zentraler Hook (`useHideWebViewsOnOverlay`)
   würde das konsistent machen.
5. **Session-Restore nutzt `setTimeout(…, 500)`:** Ein Race, wenn das Fenster
   schneller/langsamer lädt. Eleganter wäre ein Event-basierter Ansatz.

---

## 10. Qualitätssicherung

```bash
npm install          # Abhängigkeiten
npm run dev          # Entwicklung (Vite + tsc --watch + Electron)
npm run lint         # ESLint
npm test             # Vitest (66 Tests)
npm run build        # vite build + tsc
```

Die Tests decken ab:

| Suite | Inhalt |
|---|---|
| `src/lib/tabSearch.test.ts` | Ranking/Suche der neuen Tab-Suche, Highlighting, Auswahlnavigation |
| `src/lib/format.test.ts` | Speicher-/Byte-Formatierung (Regression 8.3) |
| `src/components/TabSearchOverlay.test.tsx` | Rauchtest: Rendering der neuen Suche |
| `electron/ShortcutPresets.test.ts` | Presets, Kopier-Schutz, Shortcut-Validierung (8.11) |
| `electron/SettingsManager.test.ts` | Defaults, Merge, Emoji-Migration, Farb-Backfill, defekte Datei |
| `electron/AdBlockManager.test.ts` | Whitelist-Logik (Subdomains, www., Gross/Klein) |
