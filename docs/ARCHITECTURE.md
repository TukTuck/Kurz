# MashAI / Kurz – Code-Erklärung

> Neu geschrieben am 27.09.2026 · Branch `arena/01a0e39c-kurz`
> Dieser Text erklärt den Code von null an: Wer liest, versteht danach, warum die
> App so gebaut ist, wie sie gebaut ist – und was passiert, wenn man klickt.
>
> Die **Liste der behobenen Fehler** steht in [REVIEW.md](REVIEW.md), damit sich
> hier nichts doppelt.

---

## 0. In einem Satz

Ein Electron-Browser, der mehrere KI-Webseiten (ChatGPT, Claude, Gemini, …) in
**Profilen** und **Tabs** organisiert und dabei so tut, als wäre es ein Browser –
inklusive Tab-Suspension, Side Panel, Adblocking und Session-Wiederherstellung.

Der interessante Teil ist nicht die Oberfläche, sondern die Frage:
**Wie hält man 20 Webseiten im Speicher, ohne 20 Prozesse zu bezahlen?**
Die Antwort der App ist *Lazy Loading + Suspension*, und davon ist fast jede
Entscheidung im Code abgeleitet.

---

## 1. Die drei Prozesse

| Prozess | Wo | Was |
|---|---|---|
| **Hauptprozess** | `electron/main.ts` → `dist/electron/main.js` | Fenster, Tabs, Dateien, Adblocking, Trays. Darf alles. |
| **Renderer** | `src/App.tsx` (React) | Die sichtbare Oberfläche. Darf nichts außer IPC. |
| **Zusatzfenster** | `#/settings`, `#/downloads`, `quick-search.html` | Separate React- bzw. Vanilla-Einstiege im gleichen Bundle |

Es gibt **keine `<webview>`-Tags.** Jeder Tab ist ein `WebContentsView`, das
direkt an `mainWindow.contentView` gehängt wird (`electron/TabManager.ts:902`
`createTab`). Das ist der wichtigste architektonische Punkt, denn daraus folgt:

> **Spielregel 1: Der Web-Inhalt liegt ÜBER der React-Oberfläche.**
> Views, die später angehängt werden, verdecken die früheren – und das
> Fenster-`webContents` (also React) ist das erste Kind. Deshalb ist die
> React-Leiste nur oben im 36-px-Bereich sichtbar (`TITLEBAR_HEIGHT`), und
> jedes Overlay im Renderer muss vorher die Views entkoppeln
> (`hide-webview` → `TabManager.hideAllViews()`, `electron/TabManager.ts:164`).

Wer das nicht weiß, versteht nicht, warum die App an vielen Stellen
`hideWebView()`/`showWebView()` aufruft.

---

## 2. Start: `app.whenReady() → createWindow()` (`electron/main.ts:589`)

Reihenfolge in `createWindow()` (ab `main.ts:296`):

1. **`SettingsManager`** (`main.ts:299`) – liest `settings.json` oder schreibt
   Defaults. Muss zuerst da sein, weil alles andere danach fragt.
2. **`ProfileManager`** (`main.ts:300`) – lädt die Profilliste aus den Settings.
3. **`cleanupOrphanPartitions()`** (`main.ts:81`, aufgerufen `:304`) – löscht
   Partition-Ordner von Profilen, die es nicht mehr gibt. Das ist Aufräumen für
   den Fall, dass das Löschen beim Profil-Delete nicht komplett geklappt hat.
4. **Favicons vorladen** (`ensureProvidersFavicons`, `main.ts:309`) – holt die
   Icons der Provider als base64, damit die Oberfläche sie offline hat.
5. **Fenster** erzeugen (`main.ts:322`) – Geometrie aus `session.json`, aber nur
   wenn `general.rememberWindowPosition` an ist.
6. **Manager verdrahten** (`main.ts:366-487`):
   `TabManager` → `SessionManager` → `DownloadManager` → `AdBlockManager` →
   `QuickSearchManager` → `MenuBuilder` → `TrayManager`.
   Auffällig: Die Reihenfolge ist nicht zufällig, sondern folgt den Abhängigkeiten.
   `TrayManager` bekommt den `TabManager` hinterher über `setTabManager()`
   (`main.ts:442`), weil er ihn nur zum Suspendieren braucht.
7. **IPC registrieren** (`main.ts:448-489`) – siehe Abschnitt 5.
8. **`did-finish-load`** (`main.ts:531`) – der eigentliche Start der Oberfläche:
   Profile schicken, Session wiederherstellen, und wenn gar nichts übrig ist,
   einen Tab im ersten Profil anlegen.

Wichtig: `mainWindow.on('close')` (`main.ts:510`) fängt das Schließen ab. Ob die
App wirklich beendet oder nur ins Tray versteckt wird, entscheidet
`TrayManager.isMinimizeToTrayEnabled()`.

---

## 3. Der Tab-Lebenszyklus

Das ist der Kern. Ein Tab ist **nicht** ein Fenster, sondern ein Eintrag plus
optional ein View.

### 3.1 Die zwei Zustände

| | `loaded: true` | `loaded: false` |
|---|---|---|
| View | ja (`WebContentsView`) | nein |
| RAM | ja (eigener Renderer-Prozess) | praktisch null |
| Inhalt | URL geladen | nur Metadaten |

Metadaten (`TabEntry`, `TabManager.ts:39`): `id, profileId, title, url, loaded,
suspended, lastActiveTime, faviconDataUrl, isMediaPlaying, isAudible,
excludeFromSuspension`.

### 3.2 Erzeugen

* **`createTab()`** (`TabManager.ts:902`) – erzeugt View **sofort**. Für alles,
  was der Nutzer aktiv tut (Klick, „Neuer Tab", Kontextmenü).
* **`registerTabMetadata()`** (`TabManager.ts:294`) – nur Metadaten. Für den
  Session-Restore.

Beide akzeptieren `afterTabId`: Damit landet ein per Strg+Klick geöffneter Tab
**hinter** seinem Elterntab statt am Ende.

> **Spielregel 2: `tabOrder` ist die Wahrheit für die Reihenfolge.**
> `tabs` ist nur eine Map für den Zugriff per Id. Alles, was Reihenfolge braucht
> (`getTabsForProfile`, `getAllTabs`, Ctrl+Tab), läuft über `tabOrder`.
> Drag & Drop schreibt `reorderTabs()` (`TabManager.ts:1113`).

### 3.3 Aktivieren: `switchTo()` (`TabManager.ts:960`)

1. Tab nicht geladen? → `loadTab()` (`:796`) erzeugt das View und lädt die URL.
   Vorher geht `tab-loading` an den Renderer (Spinner).
2. Der **verlassene** Tab bekommt `lastActiveTime = Date.now()` – das ist der
   Zeitstempel, ab dem er „untätig" ist.
3. Das View des alten Taks wird entfernt – **außer** es ist das angepinnte
   Side-Panel-View, das muss sichtbar bleiben.
4. Das neue View wird angehängt.

### 3.4 Suspendieren: `unloadTab()` (`TabManager.ts:851`)

Schließt `webContents`, behält die Metadaten, setzt `suspended = true` und
schickt `{loaded: false, suspended: true}` an den Renderer. Die URL ist im
Metadaten-Eintrag, also geht beim nächsten Klick nichts verloren – nur der
Scroll-Zustand und der JS-Speicher der Seite.

Vier Auslöser:

| Auslöser | Wo |
|---|---|
| Inaktivitäts-Timer (60-Sekunden-Takt) | `_checkInactiveTabs()` `TabManager.ts:225` |
| Profilwechsel mit Verhalten „suspend" | `TabHandlers.ts:switch-profile` |
| Minimieren ins Tray | `TrayManager._suspendTabs()` |
| manuell (Kontextmenü) | `MenuBuilder` |

Geschützt bleiben: der aktive Tab, Tabs mit Audio/Video (`isMediaPlaying` /
`isAudible`), Tabs mit „Never Suspend This Tab", und optional der aktive Profil
(`excludeActiveProfile`).

> **Spielregel 3: `suspended` muss beim Laden zurückgesetzt werden.**
> Sonst zeigt die Oberfläche den Tab für immer als „suspendiert" an. (Genau das
> war Fehler #1 in [REVIEW.md](REVIEW.md).)

### 3.5 Schließen: `closeTab()` (`TabManager.ts:1005`)

View entfernen, `webContents.close()`, aus `tabs` und `tabOrder` löschen. Wenn
es der angepinnte Tab war, erst `unpinSidePanel()`. Geschlossene Tabs landen in
einer `closedTabs`-Liste (max. `MAX_CLOSED_TABS` = 10) für Strg+Shift+T.

---

## 4. Side Panel

Pro Profil gibt es **genau einen** angepinnten Tab:
`sidePanelByProfile: Map<profileId, SidePanelState>` (`TabManager.ts:96`).
`SidePanelState = { pinnedTabId, panelSide, panelWidth }`.

`updateViewBounds()` in `electron/main.ts:235` teilt das Fenster dann auf:

```
panelWidth% = panelWidth, Rest = Hauptbereich, dazwischen 4 px Divider
```

Beim **Profilwechsel** (`switchSidePanelForProfile`, `TabManager.ts:1172`) wird
das View des alten Profils entfernt und das des neuen eingehängt – deshalb kann
man pro Profil ein anderes Panel haben.

Der Divisor im Renderer ist reines CSS und schickt bei jeder Mausbewegung
`set-panel-width` (`App.tsx:460`). Geklemmt wird serverseitig auf 20–80 %
(`TabManager.setPanelWidth`, `TabManager.ts:1366`).

---

## 5. IPC – wer mit wem redet

Der Renderer erreicht den Hauptprozess **ausschließlich** über `preload.ts`
(`contextIsolation: true`, `nodeIntegration: false`). Alle Kanäle:

### Renderer → Hauptprozess

| Art | Kanäle |
|---|---|
| Tabs | `create-tab`, `create-tab-with-url`, `create-tab-active-profile`, `switch-tab`, `close-tab`, `duplicate-tab`, `reload-tab`, `reopen-closed-tab`, `close-other-tabs`, `close-tabs-to-right`, `reorder-tabs` |
| Profile | `get-profile-tabs`, `switch-profile`, `get-all-tabs`, `get-active-profile-id` |
| Side Panel | `pin-to-side-panel`, `unpin-side-panel`, `swap-panel-side`, `set-panel-width`, `get-side-panel-state`, `pulse-side-panel` |
| Settings | `get-settings`, `save-settings`, `delete-profile`, `validate-shortcut`, `select-download-folder` |
| Fenster/Views | `window-minimize`, `window-maximize`, `window-close`, `hide-webview`, `show-webview` |
| Menüs | `show-context-menu`, `show-profile-menu`, `show-new-tab-menu` |
| Downloads | `get-downloads`, `cancel-download`, `pause-download`, `resume-download`, `open-download`, … |
| Sonstige | `nav-back`, `nav-forward`, `nav-reload`, `clear-privacy-data`, `open-external`, `get-adblock-status`, `update-adblock-lists`, `get-all-tabs-memory`, `toggle-quick-search` |

`send` = Feuer und vergessen, `invoke` = mit Antwort (`Promise`).

### Hauptprozess → Renderer

| Kanal | Bedeutung |
|---|---|
| `tab-created` | neuer Tab (mit `afterTabId`, `background`) |
| `tab-updated` | Teilaktualisierung: `title`, `url`, `loaded`, `suspended`, `isLoading`, `isMediaPlaying`, `isAudible`, `faviconDataUrl` |
| `tab-loading` | „fange an zu laden" (Spinner) |
| `tab-closed-backend` | Hauptprozess hat geschlossen (Menü-Aktionen) |
| `profile-tabs-loaded` | Antwort auf `get-profile-tabs` |
| `restore-active` | „das ist der aktive Tab nach dem Start" |
| `side-panel-state-changed` | Panel wurde angepinnt/verändert/geleert |
| `show-toast` | Kurzmitteilung |
| `settings-updated`, `profile-deleted` | Settings-Fenster hat geändert |
| `window-maximized`, `open-tab-search`, `pulse-side-panel` | UI-Ereignisse |

> **Spielregel 4: `tab-updated` ist ein Patch, kein Snapshot.**
> Der Renderer mergt nur die Felder, die tatsächlich `!== undefined` sind
> (`App.tsx:115`). Felder, die nie gesendet werden, bleiben auf dem alten Wert –
> deshalb ist das `suspended: false` in Abschnitt 3.4 kein Detail, sondern Pflicht.

---

## 6. Renderer: `App.tsx`

`App.tsx` hält genau fünfState-Brocken: `profiles`, `tabs`, `activeProfileId`,
`activeTabId`, `sidePanelState` – plus Kosmetik (Toasts, Speicherwerte).

Ablauf beim Start (`loadInitialData`, `App.tsx:46`): Settings holen, dann
`getAllTabs()`. Danach füllen die `tab-created`-Events aus der
Session-Wiederherstellung die Liste.

Wichtige Handler:

| Handler | Zeile | Aufgabe |
|---|---|---|
| `handleTabCreated` | `:79` | Hängt den Tab ein – nach `afterTabId`, wenn vorhanden. `background: true` → nicht umschalten. |
| `handleTabUpdated` | `:115` | Patch-Merge (siehe Spielregel 4). |
| `handleProfileTabsLoaded` | `:149` | **Ersetzt** die ganze Tab-Liste durch die Tabs des Profils. |
| `handleRestoreActive` | `:137` | Setzt aktiven Tab + Profil nach dem Start. |
| `switchTab` | `:266` | Falls der Tab zu einem anderen Profil gehört: **erst** Profil wechseln, dann Tab. |
| `closeTab` | `:283` | Rechnet lokal aus, welcher Tab danach aktiv ist (Elterntab → Nachbar → letzter). |

> **Spielregel 5: Der Renderer arbeitet optimistisch.**
> Er ändert seinen State sofort und schickt den Auftrag hinterher. Der
> Hauptprozess bestätigt über Events. Beide Seiten können also kurzfristig
> auseinanderlaufen; die Events sind die Wahrheit.

`TitleBar.tsx` ist die Tab-Leiste: Drag & Drop (`onDragStart`/`onDrop`, ab
`:230`), Favicon-Auflösung in vier Stufen (`getIconForTab`, `:77`), Kontextmenü
per Rechtsklick, und der Tooltip mit Speicherangabe.

---

## 7. Session-Persistenz

`SessionManager.saveSession()` (`SessionManager.ts:57`) schreibt `session.json`:

* alle Tabs als Metadaten (inkl. `faviconDataUrl`)
* `activeTabId`, `lastActiveProfileId`, `activeTabByProfile`
* Fenstergeometrie (nur wenn erlaubt)
* `sidePanelByProfile`

Aufgerufen wird das an vielen Stellen: nach jedem Tab-Erzeugen, Schließen,
Profilwechsel, Suspend – und beim Beenden (`main.ts:591`, `:609`).

`restoreSession()` (`SessionManager.ts:120`) liest die Datei und entscheidet an
`performance.tabLoadingStrategy`, was sofort ein View bekommt:

| Strategie | Effekt |
|---|---|
| `all` | alles laden (viel RAM, schnellster Tab-Wechsel) |
| `activeProfile` | nur Tabs des letzten aktiven Profils |
| `lastActiveOnly` | nur den zuletzt aktiven Tab (Default) |

Danach 500 ms warten, auf den aktiven Tab schalten, Side Panel wiederherstellen.

---

## 8. Adblocking (`AdBlockManager.ts`)

Zehn EasyList-/uBlock-Listen werden einzeln geladen (jede mit eigenem
Fortschritt im Log), zu einem `ElectronBlocker` kombiniert und pro Partition
`persist:<profileId>` aktiviert (`enableForSession`, `:306`).

* Serialisiert nach `adblock-cache.bin`, Metadaten nach `adblock-metadata.json`
* Cache älter als 24 h → Update im Hintergrund
* Whitelist gegen Hostname inkl. Subdomains (`isWhitelisted`, `:399`)
* Kosmetische Filter werden als CSS nach `did-finish-load` injiziert
  (`getCosmeticFilters`, `:421`)

Blockierte Requests werden gezählt und im Log protokolliert – der Zähler ist
session-lokal, keine Statistik über Neustarts.

---

## 9. Einstellungen

`SettingsManager` (`electron/SettingsManager.ts`):

* `getDefaultSettings()` (`:21`) – die 15 Provider, 2 Profile, alle Defaults
* `loadSettings()` (`:175`) – liest die Datei und **repariert** sie:
  * Provider ohne `color` bekommen die Default-Farbe
  * Profile mit Emoji-Icon werden auf Lucide-Iconnamen migriert
  * Profile ohne `color` bekommen eine
* `saveSettings()` (`:233`) – **flacher** Merge: `{...alt, ...neu}`

Das Settings-Fenster ist ein eigener Renderer-Einstieg (`SettingsApp.tsx` →
`SettingsModal.tsx`). Es lädt die Settings, lässt sie in acht Tabs bearbeiten
(General, Privacy, AdBlocker, Profiles, Providers, Performance, Shortcuts,
About) und schickt beim „Apply" das **komplette** Objekt zurück an
`save-settings`.

Der Hauptprozess reagiert darauf sofort (`SettingsHandlers.ts:147`): Tabs
gelöschter Profile schließen, Partitionen leeren, Favicons nachladen,
Profilwechsel-Verhalten anwenden, Tray aktualisieren, Adblock ein/aus, Menü
neu bauen, und allen Fenstern `settings-updated` schicken.

---

## 10. Downloads & Privatsphäre

**Downloads:** `TabManager` fängt `will-download` pro Session ab (nur einmal pro
Partition, `TabManager.ts:655`), entscheidet anhand der Settings, ob direkt
gespeichert oder erst gefragt wird, und übergibt an `DownloadManager`
(`electron/DownloadManager.ts`). Der Manager trackt Verlauf, Fortschritt und Geschwindigkeit
und sendet `download-update` an Haupt- und Download-Fenster. History liegt
in `downloads-history.json` (max. 100 Einträge).

**Privatsphäre:** `PrivacyHandlers` (`electron/ipc/PrivacyHandlers.ts`) löscht
pro Profil Cache, Cookies oder Site-Daten über `session.clearStorageData()`.
Profil-Löschen geht weiter: Tabs schließen, Partition leeren, Partition-Ordner
von der Platte löschen, aus den Settings entfernen (`SettingsHandlers.ts:47`).

---

## 11. Wenn du liest, um mitzuarbeiten: empfohlene Reihenfolge

1. `electron/types/index.ts` – das Vokabular (Tab, Profile, Settings, Session)
2. `electron/main.ts` – wer existiert und wer wen kennt
3. `electron/TabManager.ts` – der Kern (lang, aber linear lesbar)
4. `electron/preload.ts` + `src/types/index.ts` – die Schnittstelle
5. `src/App.tsx` – wie der Renderer darauf reagiert
6. `src/components/TitleBar.tsx` – die sichtbare Leiste
7. erst danach: `SessionManager`, `AdBlockManager`, `TrayManager`

---

## 12. Fallen, die man kennen sollte

Diese Dinge sind keine Abstürze, aber jeder, der hier Änderungen macht, tritt früher oder später hinein:

| Falle | Warum |
|---|---|
| **Overlay hinter dem Web-Inhalt** | Spielregel 1. Jedes Renderer-Overlay braucht `hide-webview`. |
| **`tabOrder` vs. `tabs`** | Map-Reihenfolge ≠ Anzeigereihenfolge. Immer `getTabsForProfile()`/`getAllTabs()` benutzen. |
| **`tab-updated` ist ein Patch** | Nie ein ganzes Tab-Objekt senden, Felder nur wenn gesetzt. |
| **Zwei Typ-Dateien** | `electron/types/index.ts` und `src/types/index.ts` sind nahezu identisch. Änderungen müssen doppelt erfolgen – oder auseinanderlaufen. |
| **Typen ≠ Realität im Preload** | `src/types/index.ts` beschreibt teils, was sein *soll*: `onMaximized` gibt es im Preload nicht, `getProfileTabs` ist dort ein `send`, keine `Promise`. Solange es niemand benutzt, fällt es nicht auf. |
| **`profile-tabs-loaded` ersetzt die Liste** | Nach einem Profilwechsel kennt der Renderer nur noch die Tabs des aktiven Profils. |
| **`setTimeout(500)` beim Restore** | Fixer Zeitwert statt Event. Bei langsamem Start kann das mit dem ersten Klick des Nutzers kollidieren. |
| **Flacher Merge in `saveSettings`** | Verschachtelte Objekte werden ersetzt, nicht gemergt. Geht nur gut, weil der Renderer immer alles schickt. |

---

## 13. Befunde dieser Analyse (nicht angefasst)

Die Fehler aus [REVIEW.md](REVIEW.md) sind behoben. Folgende Punkte sind in
diesem Durchgang **neu aufgefallen** und bewusst unverändert geblieben:

1. **`SettingsModal.tsx:33` – Hooks nach frühem Return.**
   `if (!isOpen) return null` steht **vor** 14 `useState`-Aufrufen und sechs
   `useEffect`s. Sobald `isOpen` im montierten Zustand von `false` auf `true`
   wechselt, wirft React „Rendered more hooks than during the previous render".
   Heute passiert es nicht, weil `SettingsApp` immer `isOpen={true}` übergibt.
   Fix: die eine Zeile hinter die Hooks ziehen (oder `{isOpen && <…>}` außenrum).

2. **`SettingsModal.tsx:189` – `defaultProfileId` wird bei jedem Speichern überschrieben.**
   `handleApply()` setzt `defaultProfileId: profiles[0]?.id`. Gelesen wird der
   Wert nirgends (nur als Fallback beim Profil-Löschen). Das „Standardprofil"
   ist damit eine eingebaute Lüge: Es ist immer das erste Profil.

3. **`DownloadsWindow.tsx:23` – doppelte `formatBytes`.**
   Es gibt jetzt eine getestete Fassung in `src/lib/format.ts`; das
   Download-Fenster hat weiterhin seine eigene. Verhalten ist gleich, nur die
   Wartung ist doppelt.

4. **`NewTabPopover.tsx` ist toter Code.** Die Komponente wird nirgends
   eingebunden (das TitleBar-Menü nimmt das native Menü). Sie ist außerdem die
   einzige Stelle, die `hideWebView()`/`showWebView()` benutzt – diese Kanäle
   funktionieren jetzt, aber ihr einziger Aufrufer existiert nicht.

5. **`electron/constants.ts` – halbe Datei ungenutzt.** `IPC_EVENTS`,
   `PERFORMANCE_DEFAULTS`, `GENERAL_DEFAULTS`, `SESSION_RESTORE_DELAY_MS` werden
   nirgends importiert. Die String-Literale stehen stattdessen direkt in den
   Handlern – was bedeutet: Die Konstante, die Tippfehler verhindern soll,
   verhindert nichts.

6. **`SettingsHandlers.ts:303` – `get-memory-usage` hat keinen Aufrufer.**
   Der Renderer nutzt nur `get-all-tabs-memory`. Beide rechnen dieselbe Zahl
   zweimal.

---

## 14. Verifikation

```bash
npm test           # 66 Tests
npm run lint
npm run build
npm run preview:ui # klickbare Vorschau mit gemockter Electron-API
```

Siehe [REVIEW.md](REVIEW.md) für den Prüfpfad mit Datei:Zeile.
