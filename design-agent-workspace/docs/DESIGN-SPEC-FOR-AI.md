# TISCH Design-Spezifikation für UI/Design-KI

**Stand:** 2026-10-06  
**Basis:** MashAI/Kurz Electron-App → TISCH Umbau  
**Ziel:** Diese Spezifikation beschreibt die technischen Schnittstellen und Anforderungen für das UI-Design.

---

## 1. Architektur-Überblick

### Technologie-Stack
- **Framework:** Electron 39 + React 18 + TypeScript 5.9
- **Build-Tool:** Vite 6.4 (Hot Module Replacement)
- **Styling:** Tailwind CSS 3.x (Utility-first, JIT Compiler)
- **State Management:** React Hooks (useState, useEffect, useRef, useCallback)
- **IPC:** Electron contextBridge + ipcRenderer/ipcMain
- **Canvas (geplant):** React Flow 11.x (@xyflow/react)
- **Icons:** Lucide React (Tree-shakeable SVG icons)
- **Fonts:** Inter (UI), JetBrains Mono (Code), Caveat (Handwriting)

### Projekt-Struktur
```
Kurz/
├── electron/              # Main Process (Node.js)
│   ├── main.ts           # Entry point
│   ├── TabManager.ts     # Tab lifecycle
│   ├── ProfileManager.ts # Profile isolation
│   ├── SessionManager.ts # Persistence
│   ├── SettingsManager.ts # Config
│   └── ipc/              # IPC Handlers
│       ├── TabHandlers.ts
│       ├── ProfileHandlers.ts
│       └── SettingsHandlers.ts
├── src/                   # Renderer Process (React)
│   ├── App.tsx           # Root component
│   ├── components/       # UI components
│   │   ├── TitleBar.tsx
│   │   ├── TabSearchOverlay.tsx
│   │   └── settings/
│   ├── types/            # TypeScript definitions
│   │   └── index.ts
│   └── lib/              # Utility functions
├── public/               # Static assets
│   └── mock-api.js       # Browser mock (dev only)
└── docs/                 # Documentation
```

### Component-Tree (aktuell)
```
App
├── Topbar
│   ├── Logo (TISCH branding)
│   ├── Button "+ Neue Karte"
│   └── StatusText (profiles + tabs count)
├── Sidebar
│   ├── ProfileSection
│   │   ├── Header "PROFILE"
│   │   └── ProfileList
│   │       └── ProfileButton (multiple)
│   └── CardSection
│       ├── Header "KARTEN (X)"
│       └── CardList (scrollable)
│           └── CardItem (multiple)
├── Canvas (Hauptbereich)
│   ├── GridBackground (CSS pattern)
│   ├── WelcomeCard (placeholder)
│   └── ActiveCardInfo (conditional)
└── FloatingBar
    ├── StatusTitle
    ├── StatusDetails
    └── Button "Details"
```

---

## 2. Datenstrukturen

### Profile
```typescript
interface Profile {
  id: string;           // z.B. "work", "personal"
  name: string;         // Anzeigename
  icon: string;         // Icon-Name (Lucide)
  color: string;        // Hex-Farbe
}
```

### TabInfo (Karten)
```typescript
interface TabInfo {
  id: string;                    // Eindeutige ID
  profileId: string;             // Zugehöriges Profil
  url: string;                   // URL (für WebChat) oder API-Endpoint
  title: string;                 // Anzeigetitel
  loaded: boolean;               // Ist Inhalt geladen?
  suspended?: boolean;           // Ist Tab suspendiert?
  faviconDataUrl?: string;       // Favicon als Base64
  isLoading?: boolean;           // Lädt gerade?
  isMediaPlaying?: boolean;      // Spielt Audio/Video?
  isAudible?: boolean;           // Hat Audio?
}
```

### Settings
```typescript
interface Settings {
  profiles: Profile[];
  defaultProfileId: string;
  aiProviders: AIProvider[];     // Verfügbare AI-Dienste
  defaultProviderId: string;
  performance: PerformanceSettings;
  general: GeneralSettings;
  security?: SecuritySettings;
  adBlock?: AdBlockSettings;
  shortcuts?: ShortcutSettings;
}
```

---

## 3. Aktuelle UI-Komponenten

### Topbar (oben, 48px hoch)
**Zweck:** Globale Aktionen und Status

**Elemente:**
- Logo (TISCH-Branding, 32x32px)
- "+ Neue Karte" Button
- Status-Anzeige (rechts): "X Profile · Y Karten"

**Aktionen:**
- Neue Karte erstellen (öffnet Dialog/Dropdown)
- Settings öffnen (geplant)
- Suchen (Ctrl+K, geplant)

**State:**
- `profiles.length` → Anzahl Profile
- `tabs.length` → Anzahl Karten gesamt

---

### Sidebar (links, 256px breit)
**Zweck:** Navigation zwischen Profilen und Karten

**Sektionen:**

#### 1. Profile-Sektion (oben, fixiert)
- **Header:** "PROFILE" (uppercase, klein)
- **Liste:** Alle Profile als Buttons
- **Aktiv-Markierung:** Welches Profil ist aktiv?
- **Klick-Aktion:** `switchProfile(profileId)`

**State:**
- `profiles: Profile[]` → Liste aller Profile
- `activeProfileId: string` → Aktuell ausgewähltes Profil

#### 2. Karten-Sektion (unten, scrollbar)
- **Header:** "KARTEN (X)" mit Anzahl
- **Liste:** Alle Karten des aktiven Profils
- **Pro Karte:**
  - Titel ( trunciert wenn zu lang)
  - URL (klein, trunciert)
  - Aktiv-Markierung
- **Klick-Aktion:** `setActiveTabId(tabId)`

**State:**
- `currentTabs: TabInfo[]` → Karten des aktiven Profils
- `activeTabId: string | null` → Aktuell ausgewählte Karte

---

### Hauptbereich (flex-1, Karopapier-Canvas)
**Zweck:** Unendlicher Tisch mit Karten (später React Flow)

**Aktuell (Placeholder):**
- Karopapier-Hintergrund (24px Grid)
- Zentrierte Willkommens-Karte
- Aktive Karte als Info-Box (wenn vorhanden)

**Geplant (React Flow):**
- Unendlicher Canvas (zoom + pan)
- Karten als Custom Nodes
- Drag & Drop
- Verbindungen zwischen Karten (Edges)

**Node-Typen (geplant):**
1. `ChatWindow` – AI-Chat (API oder Web)
2. `Notiz` – Text-Notiz
3. `BildGen` – Bild-Generator (später)
4. `VideoGen` – Video-Generator (später)

**State:**
- `activeTab: TabInfo | undefined` → Aktuell fokussierte Karte

---

### Floating Bar (unten links, 384px breit)
**Zweck:** System-Status anzeigen

**Elemente:**
- Status-Titel ("Status")
- Status-Details (Router, Git, MCP)
- "Details" Button (öffnet Modal/Panel)

**Geplanter Inhalt:**
- **Router-Status:** "Bereit" / "Fehler" / "X Routen aktiv"
- **Git-Status:** "Lokal" / "Sync aktiv" / "X Branches"
- **MCP-Status:** "Inaktiv" / "Verbunden" / "X Tools"

**State:**
- Router-Health (geplant)
- Git-Status (geplant)
- MCP-Connection (geplant)

---

## 4. API-Schnittstellen (window.api) - Vollständig

### Window Controls
```typescript
minimize(): void                                    // Fenster minimieren
maximize(): void                                    // Fenster maximieren/toggle
close(): void                                       // Fenster schließen
hideWebView(): void                                 // Webview ausblenden (für Overlays)
showWebView(): void                                 // Webview einblenden
onMaximized(callback: (isMaximized: boolean) => void): () => void
```

### Tab-Operationen
```typescript
// Erstellen
createTab(profileId: string): void                  // Neuer Tab mit Default-URL
createTabWithUrl(profileId: string, url: string): void  // Neuer Tab mit spezifischer URL

// Navigation
switchTab(tabId: string): void                      // Zu Tab wechseln
closeTab(tabId: string): void                       // Tab schließen
duplicateTab(tabId: string): void                   // Tab duplizieren
reloadTab(tabId: string): void                      // Tab neu laden
reopenClosedTab(): void                             // Zuletzt geschlossenen Tab wiederherstellen

// Bulk-Operationen
closeOtherTabs(tabId: string, profileId: string): void    // Alle außer diesem schließen
closeTabsToRight(tabId: string, profileId: string): void  // Alle rechts davon schließen
reorderTabs(newOrder: string[]): void               // Tabs neu sortieren (Drag & Drop)

// Daten abrufen
getProfileTabs(profileId: string): Promise<{ tabs: TabInfo[]; lastActiveTabId: string | null }>
getAllTabs(): Promise<{ tabs: TabInfo[]; activeTabId: string | null }>

// Events
onTabCreated(callback: (tab: TabCreatedEvent) => void): () => void
onTabUpdated(callback: (update: TabUpdatedEvent) => void): () => void
onTabClosedBackend(callback: (tabId: string) => void): () => void
onRequestCloseTab(callback: (tabId: string) => void): () => void
onTabLoading(callback: (data: { id: string }) => void): () => void
```

### Profile-Operationen
```typescript
switchProfile(toProfileId: string): void            // Zu Profil wechseln
onProfilesLoaded(callback: (profiles: Profile[]) => void): () => void
onProfileTabsLoaded(callback: (data: ProfileTabsLoadedEvent) => void): () => void
onSwitchProfileRequest(callback: (profileId: string) => void): () => void
getActiveProfileId(): Promise<string | null>
```

### Settings
```typescript
getSettings(): Promise<Settings>
saveSettings(settings: Settings): Promise<boolean>
deleteProfile(profileId: string): Promise<{ success: boolean; error?: string }>
onSettingsUpdated(callback: (settings: Settings) => void): () => void
onProfileDeleted(callback: (profileId: string) => void): () => void
onOpenSettingsModal(callback: () => void): () => void
onOpenTabSearch(callback: () => void): () => void
validateShortcut(shortcut: string): Promise<{ valid: boolean; reason: string | null }>
```

### Navigation
```typescript
goBack(): void                                      // Browser zurück
goForward(): void                                   // Browser vorwärts
reload(): void                                      // Seite neu laden
```

### Context Menus
```typescript
showContextMenu(tabId: string): void                // Rechtsklick auf Tab
showProfileMenu(x: number, y: number, activeProfileId: string): void
showNewTabMenu(x: number, y: number, profileId: string): void
```

### Session & Memory
```typescript
onRestoreActive(callback: (tabId: string) => void): () => void
getMemoryUsage(): Promise<{ totalKB: number; tabsMemory: TabMemoryInfo[] }>
getAllTabsMemory(): Promise<TabMemoryInfo[]>
```

### Privacy
```typescript
clearPrivacyData(options: ClearPrivacyDataOptions): Promise<{ success: boolean; error?: string }>
```

### UI
```typescript
onShowToast(callback: (data: { message: string; type?: 'success' | 'error' | 'warning' | 'info' }) => void): () => void
openExternal(url: string): void                     // URL im Standard-Browser öffnen
```

### Downloads
```typescript
getDownloads(): Promise<{ active: DownloadInfo[]; history: DownloadInfo[] }>
cancelDownload(id: string): Promise<boolean>
pauseDownload(id: string): Promise<boolean>
resumeDownload(id: string): Promise<boolean>
openDownload(filePath: string): Promise<boolean>
showDownloadInFolder(filePath: string): void
clearDownloadHistory(): void
removeDownloadFromHistory(id: string): void
openDownloadsWindow(): void
hideDownloadToast(): void
selectDownloadFolder(): Promise<string | null>
onDownloadUpdate(callback: (data: { active: DownloadInfo[]; history: DownloadInfo[] }) => void): () => void
```

### Ad Blocker
```typescript
getAdBlockStatus(): Promise<AdBlockStatus>
updateAdBlockLists(): Promise<void>
```

### Side Panel (geplant für TISCH)
```typescript
pinToSidePanel(tabId: string, side?: PanelSide): void
unpinSidePanel(): void
swapPanelSide(): void
setPanelWidth(width: number): void
getSidePanelState(): Promise<SidePanelState | null>
onSidePanelStateChanged(callback: (state: SidePanelState | null) => void): () => void
onPulseSidePanel(callback: () => void): () => void
pulseSidePanel(): void
```

---

## 5. Component Props & Interfaces

### Topbar Component
```typescript
interface TopbarProps {
  profilesCount: number;
  tabsCount: number;
  onCreateCard: () => void;
  onOpenSettings?: () => void;
}

// State-Management
const [isLoading, setIsLoading] = useState(false);
const [showNewCardMenu, setShowNewCardMenu] = useState(false);
```

### Sidebar Component
```typescript
interface SidebarProps {
  profiles: Profile[];
  activeProfileId: string;
  cards: TabInfo[];
  activeCardId: string | null;
  onSwitchProfile: (profileId: string) => void;
  onSelectCard: (cardId: string) => void;
  onReorderCards?: (fromIndex: number, toIndex: number) => void;
}

// State-Management
const [searchQuery, setSearchQuery] = useState('');
const [isCollapsed, setIsCollapsed] = useState(false);
const [draggedCardId, setDraggedCardId] = useState<string | null>(null);

// Computed
const filteredCards = cards.filter(card => 
  card.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
  card.url.toLowerCase().includes(searchQuery.toLowerCase())
);
```

### Canvas Component (geplant für React Flow)
```typescript
interface CanvasProps {
  cards: TabInfo[];
  activeCardId: string | null;
  onSelectCard: (cardId: string) => void;
  onCardUpdate: (cardId: string, updates: Partial<TabInfo>) => void;
  onCardDelete: (cardId: string) => void;
  onConnect?: (sourceId: string, targetId: string) => void;
}

// React Flow Node Types
type NodeType = 'chat-window' | 'note' | 'image-gen' | 'video-gen';

interface BaseNodeData {
  id: string;
  type: NodeType;
  title: string;
  isSelected: boolean;
  isLocked: boolean;
  zIndex: number;
}

interface ChatWindowNodeData extends BaseNodeData {
  type: 'chat-window';
  provider: string;           // 'chatgpt', 'claude', 'perplexity', etc.
  mode: 'api' | 'web';        // API-Chat oder Web-Session
  status: 'idle' | 'loading' | 'streaming' | 'error';
  lastMessage?: string;
  branch?: string;            // Git-Branch Name
}

interface NoteNodeData extends BaseNodeData {
  type: 'note';
  content: string;            // Markdown oder Plain Text
  color: string;              // Hintergrundfarbe
  fontSize: number;
}
```

### FloatingBar Component
```typescript
interface FloatingBarProps {
  routerStatus: RouterStatus;
  gitStatus: GitStatus;
  mcpStatus: MCPStatus;
  onOpenDetails: () => void;
}

interface RouterStatus {
  state: 'ready' | 'error' | 'loading';
  activeRoutes: number;
  totalRoutes: number;
  lastError?: string;
}

interface GitStatus {
  state: 'local' | 'syncing' | 'synced' | 'error';
  branches: number;
  uncommittedChanges: number;
  lastCommit?: string;
}

interface MCPStatus {
  state: 'inactive' | 'connected' | 'error';
  activeTools: number;
  connectedAgents: number;
}
```

---

## 6. State-Management Patterns

### Global State (App-Level)
```typescript
// Profile State
const [profiles, setProfiles] = useState<Profile[]>([]);
const [activeProfileId, setActiveProfileId] = useState<string>('work');

// Card/Tab State
const [tabs, setTabs] = useState<TabInfo[]>([]);
const [activeTabId, setActiveTabId] = useState<string | null>(null);

// UI State
const [isSettingsOpen, setIsSettingsOpen] = useState(false);
const [isSearchOpen, setIsSearchOpen] = useState(false);
const [toastMessage, setToastMessage] = useState<string>('');

// Computed State
const currentProfile = profiles.find(p => p.id === activeProfileId);
const currentTabs = tabs.filter(t => t.profileId === activeProfileId);
const activeTab = tabs.find(t => t.id === activeTabId);
```

### State-Synchronization mit IPC
```typescript
// Initial Load
useEffect(() => {
  const loadData = async () => {
    const { tabs, activeTabId } = await window.api.getAllTabs();
    setTabs(tabs);
    setActiveTabId(activeTabId);
  };
  loadData();

  // Event Listeners
  const cleanupProfiles = window.api.onProfilesLoaded(setProfiles);
  const cleanupTabCreated = window.api.onTabCreated((tab) => {
    setTabs(prev => [...prev, tab]);
  });
  const cleanupTabUpdated = window.api.onTabUpdated((update) => {
    setTabs(prev => prev.map(t => 
      t.id === update.id ? { ...t, ...update } : t
    ));
  });
  const cleanupTabClosed = window.api.onTabClosedBackend((tabId) => {
    setTabs(prev => prev.filter(t => t.id !== tabId));
  });

  return () => {
    cleanupProfiles();
    cleanupTabCreated();
    cleanupTabUpdated();
    cleanupTabClosed();
  };
}, []);
```

---

## 7. Event-Handling Patterns

### User Actions → IPC Calls
```typescript
// Card erstellen
const handleCreateCard = (profileId: string, url?: string) => {
  if (url) {
    window.api.createTabWithUrl(profileId, url);
  } else {
    window.api.createTab(profileId);
  }
};

// Card wechseln
const handleSelectCard = (cardId: string) => {
  setActiveTabId(cardId);
  window.api.switchTab(cardId);
};

// Card schließen
const handleCloseCard = (cardId: string) => {
  window.api.closeTab(cardId);
  // State wird automatisch über onTabClosedBackend aktualisiert
};

// Profil wechseln
const handleSwitchProfile = (profileId: string) => {
  setActiveProfileId(profileId);
  window.api.switchProfile(profileId);
};
```

### Context Menu Handler
```typescript
const handleContextMenu = (e: React.MouseEvent, cardId: string) => {
  e.preventDefault();
  window.api.showContextMenu(cardId);
};
```

---

## 8. Error/Loading/Empty States

### Loading States
```typescript
// Initial Load
if (profiles.length === 0 && tabs.length === 0) {
  return <LoadingScreen message="Lade Workspace..." />;
}

// Card Loading
{card.isLoading && (
  <div className="absolute inset-0 bg-paper/80 flex items-center justify-center">
    <Spinner size="lg" />
  </div>
)}
```

### Empty States
```typescript
// Keine Profile
{profiles.length === 0 && (
  <EmptyState
    icon={<FolderPlusIcon />}
    title="Keine Profile"
    description="Erstelle dein erstes Profil um zu beginnen"
    action={<Button onClick={handleCreateProfile}>Profil erstellen</Button>}
  />
)}

// Keine Cards im Profil
{currentTabs.length === 0 && (
  <EmptyState
    icon={<MessageSquareIcon />}
    title="Keine Karten"
    description="Erstelle eine neue Karte um zu chatten"
    action={<Button onClick={handleCreateCard}>+ Neue Karte</Button>}
  />
)}
```

### Error States
```typescript
// API Error
{error && (
  <ErrorBanner
    message={error.message}
    onRetry={handleRetry}
    onDismiss={() => setError(null)}
  />
)}

// Card Error
{card.status === 'error' && (
  <div className="border-l-4 border-accent-red p-4 bg-red-50">
    <p className="text-sm text-red-800">Fehler beim Laden der Karte</p>
    <button onClick={() => handleReloadCard(card.id)}>
      Erneut versuchen
    </button>
  </div>
)}
```

---

## 9. Keyboard Shortcuts

### Globale Shortcuts
```typescript
const shortcuts = {
  'Ctrl+K': () => setIsSearchOpen(true),           // Suche öffnen
  'Ctrl+,': () => setIsSettingsOpen(true),         // Settings öffnen
  'Ctrl+N': () => handleCreateCard(activeProfileId), // Neue Karte
  'Ctrl+W': () => activeTabId && handleCloseCard(activeTabId), // Karte schließen
  'Ctrl+Tab': () => handleNextCard(),              // Nächste Karte
  'Ctrl+Shift+Tab': () => handlePrevCard(),        // Vorherige Karte
  'Ctrl+1-9': (num) => handleSwitchToCard(num),    // Zu Karte N springen
  'Escape': () => {
    setIsSearchOpen(false);
    setIsSettingsOpen(false);
  },
};
```

### Sidebar Shortcuts
```typescript
const sidebarShortcuts = {
  'ArrowDown': () => focusNextCard(),
  'ArrowUp': () => focusPrevCard(),
  'Enter': () => handleSelectCard(focusedCardId),
  'Delete': () => handleCloseCard(focusedCardId),
};
```

---

## 10. Context Menu Strukturen

### Card Context Menu
```typescript
interface CardContextMenu {
  items: [
    { label: 'Öffnen', action: 'open', icon: 'external-link' },
    { label: 'Duplizieren', action: 'duplicate', icon: 'copy' },
    { label: 'Neu laden', action: 'reload', icon: 'refresh' },
    { type: 'separator' },
    { label: 'Anheften', action: 'pin', icon: 'pin', checked: boolean },
    { label: 'Sperren', action: 'lock', icon: 'lock', checked: boolean },
    { type: 'separator' },
    { label: 'Schließen', action: 'close', icon: 'x', shortcut: 'Ctrl+W' },
    { label: 'Andere schließen', action: 'close-others', icon: 'x-circle' },
    { label: 'Rechts schließen', action: 'close-right', icon: 'arrow-right' },
  ];
}
```

### Profile Context Menu
```typescript
interface ProfileContextMenu {
  items: [
    { label: 'Bearbeiten', action: 'edit', icon: 'edit' },
    { label: 'Duplizieren', action: 'duplicate', icon: 'copy' },
    { type: 'separator' },
    { label: 'Löschen', action: 'delete', icon: 'trash', danger: true },
  ];
}
```

### Canvas Context Menu (geplant)
```typescript
interface CanvasContextMenu {
  items: [
    { label: 'Neue Karte', action: 'create-card', icon: 'plus' },
    { label: 'Neue Notiz', action: 'create-note', icon: 'file-text' },
    { type: 'separator' },
    { label: 'Alle auswählen', action: 'select-all', icon: 'check-square' },
    { label: 'Auswahl aufheben', action: 'deselect', icon: 'x-square' },
    { type: 'separator' },
    { label: 'Zoom zurücksetzen', action: 'reset-zoom', icon: 'maximize' },
    { label: 'Alles einpassen', action: 'fit-view', icon: 'minimize' },
  ];
}
```

---

## 12. Drag & Drop Spezifikationen

### Card-Reordering in Sidebar
```typescript
// Drag Start
const handleDragStart = (e: React.DragEvent, cardId: string) => {
  e.dataTransfer.effectAllowed = 'move';
  e.dataTransfer.setData('text/plain', cardId);
  setDraggedCardId(cardId);
};

// Drag Over
const handleDragOver = (e: React.DragEvent, targetCardId: string) => {
  e.preventDefault();
  e.dataTransfer.dropEffect = 'move';
  
  // Calculate drop position (above/below)
  const rect = e.currentTarget.getBoundingClientRect();
  const midpoint = rect.top + rect.height / 2;
  const isAbove = e.clientY < midpoint;
  
  setDropIndicator({ cardId: targetCardId, position: isAbove ? 'above' : 'below' });
};

// Drop
const handleDrop = (e: React.DragEvent, targetCardId: string) => {
  e.preventDefault();
  const draggedId = e.dataTransfer.getData('text/plain');
  
  if (draggedId !== targetCardId) {
    const fromIndex = currentTabs.findIndex(t => t.id === draggedId);
    const toIndex = currentTabs.findIndex(t => t.id === targetCardId);
    
    // Adjust for drop position
    const finalIndex = dropIndicator.position === 'below' ? toIndex + 1 : toIndex;
    
    handleReorderCards(fromIndex, finalIndex);
  }
  
  setDraggedCardId(null);
  setDropIndicator(null);
};

// Drag End
const handleDragEnd = () => {
  setDraggedCardId(null);
  setDropIndicator(null);
};
```

### React Flow Node Dragging (geplant)
```typescript
// Node Position Update
const onNodeDragStop = (event: React.MouseEvent, node: Node) => {
  // Save position to backend
  window.api.updateCardPosition(node.id, {
    x: node.position.x,
    y: node.position.y,
  });
};

// Node Snapping to Grid
const snapToGrid: [number, number] = [24, 24]; // Matches Karo-Pattern

// Node Constraints
const nodeConstraints = {
  minX: -10000,
  maxX: 10000,
  minY: -10000,
  maxY: 10000,
};
```

---

## 13. Animationen & Transitions

### CSS Transitions
```css
/* Hover Effects */
.tisch-button {
  transition: all 0.15s ease;
}

.tisch-button:hover {
  transform: translateY(-1px);
  box-shadow: 0 2px 8px rgba(43, 43, 40, 0.15);
}

/* Card Selection */
.card-item {
  transition: background-color 0.2s ease, border-color 0.2s ease;
}

.card-item.selected {
  border-left: 3px solid var(--accent-purple);
  background-color: var(--paper);
}

/* Sidebar Collapse */
.sidebar {
  transition: width 0.3s cubic-bezier(0.4, 0, 0.2, 1);
}

/* Modal Fade */
.modal-overlay {
  animation: fadeIn 0.2s ease;
}

.modal-content {
  animation: slideUp 0.3s cubic-bezier(0.4, 0, 0.2, 1);
}

@keyframes fadeIn {
  from { opacity: 0; }
  to { opacity: 1; }
}

@keyframes slideUp {
  from { 
    opacity: 0;
    transform: translateY(20px);
  }
  to { 
    opacity: 1;
    transform: translateY(0);
  }
}
```

### Loading Animations
```css
/* Spinner */
@keyframes spin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}

.spinner {
  animation: spin 1s linear infinite;
}

/* Skeleton Loading */
@keyframes shimmer {
  0% { background-position: -200% 0; }
  100% { background-position: 200% 0; }
}

.skeleton {
  background: linear-gradient(
    90deg,
    var(--paper-dark) 0%,
    var(--paper) 50%,
    var(--paper-dark) 100%
  );
  background-size: 200% 100%;
  animation: shimmer 1.5s infinite;
}

/* Toast Notification */
@keyframes toastSlideIn {
  from {
    transform: translateX(100%);
    opacity: 0;
  }
  to {
    transform: translateX(0);
    opacity: 1;
  }
}

.toast {
  animation: toastSlideIn 0.3s cubic-bezier(0.4, 0, 0.2, 1);
}
```

---

## 14. Accessibility (A11y)

### ARIA Labels & Roles
```typescript
// Sidebar
<nav aria-label="Workspace Navigation">
  <section aria-labelledby="profiles-heading">
    <h2 id="profiles-heading">Profile</h2>
    <ul role="listbox" aria-label="Profile selection">
      {profiles.map(profile => (
        <li
          key={profile.id}
          role="option"
          aria-selected={profile.id === activeProfileId}
          tabIndex={0}
        >
          {profile.name}
        </li>
      ))}
    </ul>
  </section>
  
  <section aria-labelledby="cards-heading">
    <h2 id="cards-heading">
      Karten ({currentTabs.length})
    </h2>
    <ul role="listbox" aria-label="Card selection">
      {currentTabs.map(card => (
        <li
          key={card.id}
          role="option"
          aria-selected={card.id === activeTabId}
          aria-label={`${card.title} - ${card.url}`}
          tabIndex={0}
        >
          {card.title}
        </li>
      ))}
    </ul>
  </section>
</nav>

// Buttons
<button
  aria-label="Neue Karte erstellen"
  aria-haspopup="menu"
  aria-expanded={showNewCardMenu}
>
  + Neue Karte
</button>

// Status Indicators
<div
  role="status"
  aria-live="polite"
  aria-atomic="true"
>
  {statusMessage}
</div>

// Loading States
<div
  role="progressbar"
  aria-valuenow={progress}
  aria-valuemin={0}
  aria-valuemax={100}
  aria-label="Lade Karte"
>
  <Spinner />
</div>
```

### Focus Management
```typescript
// Focus Trap in Modals
const useFocusTrap = (isActive: boolean) => {
  useEffect(() => {
    if (!isActive) return;
    
    const focusableElements = document.querySelectorAll(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    );
    const firstElement = focusableElements[0] as HTMLElement;
    const lastElement = focusableElements[focusableElements.length - 1] as HTMLElement;
    
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Tab') {
        if (e.shiftKey) {
          if (document.activeElement === firstElement) {
            lastElement.focus();
            e.preventDefault();
          }
        } else {
          if (document.activeElement === lastElement) {
            firstElement.focus();
            e.preventDefault();
          }
        }
      }
    };
    
    document.addEventListener('keydown', handleKeyDown);
    firstElement?.focus();
    
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isActive]);
};

// Restore Focus after Modal Close
const handleModalClose = () => {
  setIsModalOpen(false);
  // Restore focus to trigger element
  triggerElementRef.current?.focus();
};
```

### Color Contrast
```typescript
// WCAG 2.1 AA Compliance
const colorContrast = {
  // Text on Paper Background
  'ink-on-paper': '4.5:1',        // #2B2B28 on #F2EAD3 ✓
  'ink-light-on-paper': '4.5:1',  // #4A4A47 on #F2EAD3 ✓
  
  // Text on Dark Background
  'paper-on-sidebar': '4.5:1',    // #F2EAD3 on #E8DCC4 ✓
  
  // Accent Colors
  'purple-on-paper': '4.5:1',     // #8B5CF6 on #F2EAD3 ✓
  'red-on-paper': '4.5:1',        // #C4453B on #F2EAD3 ✓
  
  // Interactive Elements
  'white-on-purple': '4.5:1',     // #FFFFFF on #8B5CF6 ✓
  'white-on-red': '4.5:1',        // #FFFFFF on #C4453B ✓
};
```

### Screen Reader Announcements
```typescript
// Live Region for Dynamic Content
const announceToScreenReader = (message: string, priority: 'polite' | 'assertive' = 'polite') => {
  const announcement = document.createElement('div');
  announcement.setAttribute('role', 'status');
  announcement.setAttribute('aria-live', priority);
  announcement.setAttribute('aria-atomic', 'true');
  announcement.className = 'sr-only'; // Visually hidden but accessible
  announcement.textContent = message;
  
  document.body.appendChild(announcement);
  
  setTimeout(() => {
    document.body.removeChild(announcement);
  }, 1000);
};

// Usage
const handleCardCreated = (card: TabInfo) => {
  announceToScreenReader(`Karte "${card.title}" erstellt`);
};

const handleCardClosed = (cardId: string) => {
  announceToScreenReader('Karte geschlossen');
};
```

---

## 15. React Flow Node Interface (Detailliert)

### Custom Node Component
```typescript
import { Handle, Position, NodeProps } from '@xyflow/react';

interface ChatWindowNodeProps extends NodeProps {
  data: ChatWindowNodeData;
  selected: boolean;
}

const ChatWindowNode: React.FC<ChatWindowNodeProps> = ({ data, selected }) => {
  return (
    <div
      className={`
        tisch-card rounded-lg overflow-hidden
        ${selected ? 'ring-2 ring-accent-purple' : ''}
        ${data.isLocked ? 'opacity-75' : ''}
      `}
      style={{ 
        width: 400, 
        height: 500,
        transform: `rotate(${data.rotation || 0}deg)`
      }}
    >
      {/* Input Handle (für Verbindungen von anderen Nodes) */}
      <Handle
        type="target"
        position={Position.Left}
        className="!bg-accent-purple !w-3 !h-3"
      />
      
      {/* Header */}
      <div className="bg-paper-dark px-4 py-2 flex items-center justify-between border-b border-grid-line">
        <div className="flex items-center gap-2">
          <img src={data.favicon} alt="" className="w-4 h-4" />
          <span className="text-sm font-medium text-ink">{data.title}</span>
        </div>
        <div className="flex items-center gap-1">
          <button className="p-1 hover:bg-paper rounded" aria-label="Minimieren">
            <MinimizeIcon size={14} />
          </button>
          <button className="p-1 hover:bg-paper rounded" aria-label="Schließen">
            <XIcon size={14} />
          </button>
        </div>
      </div>
      
      {/* Content Area */}
      <div className="flex-1 bg-paper p-4 overflow-y-auto">
        {data.mode === 'api' ? (
          <ApiChatInterface provider={data.provider} />
        ) : (
          <WebChatInterface url={data.url} />
        )}
      </div>
      
      {/* Footer mit Status */}
      <div className="bg-paper-dark px-4 py-2 border-t border-grid-line flex items-center justify-between text-xs">
        <div className="flex items-center gap-2">
          <StatusIndicator status={data.status} />
          <span className="text-ink-light">{data.branch || 'main'}</span>
        </div>
        <div className="text-ink-light">
          {data.lastUpdated && formatTimeAgo(data.lastUpdated)}
        </div>
      </div>
      
      {/* Output Handle (für Verbindungen zu anderen Nodes) */}
      <Handle
        type="source"
        position={Position.Right}
        className="!bg-accent-purple !w-3 !h-3"
      />
    </div>
  );
};
```

### Node Registry
```typescript
const nodeTypes = {
  'chat-window': ChatWindowNode,
  'note': NoteNode,
  'image-gen': ImageGenNode,
  'video-gen': VideoGenNode,
};

// Usage in React Flow
<ReactFlow
  nodes={nodes}
  edges={edges}
  nodeTypes={nodeTypes}
  onNodesChange={onNodesChange}
  onEdgesChange={onEdgesChange}
  onConnect={onConnect}
  snapToGrid={true}
  snapGrid={[24, 24]}
/>
```

---

## 16. Performance Considerations

### Virtualization für lange Listen
```typescript
import { FixedSizeList } from 'react-window';

// Sidebar Card List (wenn >50 Karten)
{currentTabs.length > 50 ? (
  <FixedSizeList
    height={600}
    itemCount={currentTabs.length}
    itemSize={60}
    width="100%"
  >
    {CardItem}
  </FixedSizeList>
) : (
  <div className="space-y-1">
    {currentTabs.map(card => <CardItem key={card.id} card={card} />)}
  </div>
)}
```

### Memoization
```typescript
// Expensive Computations
const filteredCards = useMemo(() => {
  return cards.filter(card => 
    card.title.toLowerCase().includes(searchQuery.toLowerCase())
  );
}, [cards, searchQuery]);

// Stable Callbacks
const handleSelectCard = useCallback((cardId: string) => {
  setActiveTabId(cardId);
  window.api.switchTab(cardId);
}, []);

// Memoized Components
const CardItem = React.memo(({ card, isSelected, onSelect }) => {
  return (
    <div className={isSelected ? 'selected' : ''} onClick={() => onSelect(card.id)}>
      {card.title}
    </div>
  );
});
```

### Lazy Loading
```typescript
// Code Splitting für Modals
const SettingsModal = lazy(() => import('./components/SettingsModal'));
const SearchOverlay = lazy(() => import('./components/SearchOverlay'));

// Suspense Boundary
<Suspense fallback={<LoadingSpinner />}>
  {isSettingsOpen && <SettingsModal />}
</Suspense>
```

---

## 17. Data Flow Diagramme

### Card Creation Flow
```
User clicks "+ Neue Karte"
  ↓
handleCreateCard(profileId, url?)
  ↓
window.api.createTab[WithUrl](profileId, url)
  ↓
[IPC] → Main Process → TabManager.createTab()
  ↓
[Event] onTabCreated(tab)
  ↓
setTabs(prev => [...prev, tab])
  ↓
UI re-renders with new card
```

### Profile Switch Flow
```
User clicks Profile in Sidebar
  ↓
handleSwitchProfile(profileId)
  ↓
setActiveProfileId(profileId)
  ↓
window.api.switchProfile(profileId)
  ↓
[IPC] → Main Process → ProfileManager.switchProfile()
  ↓
[Event] onProfileTabsLoaded({ profileId, tabs, lastActiveTabId })
  ↓
setTabs(tabs)
setActiveTabId(lastActiveTabId)
  ↓
UI re-renders with filtered cards
```

### Git Commit Flow (geplant)
```
Card receives AI response
  ↓
extractCodeSnippets(response)
  ↓
window.api.commitToBranch(cardId, snippets, metadata)
  ↓
[IPC] → Main Process → GitLoop.commit()
  ↓
git.add(files)
git.commit(message)
  ↓
[Event] onGitCommit({ cardId, branch, commitHash })
  ↓
updateCardGitStatus(cardId, commitHash)
  ↓
UI shows commit indicator on card
```

---

## 18. Design-Constraints

### Layout
- **Mindestbreite:** 1024px (Desktop-only)
- **Sidebar:** 256px fix, nicht resizable (v0.1)
- **Topbar:** 48px fix
- **Floating Bar:** 384px breit, 64px hoch, 16px Abstand unten/links

### Interaktionen
- **Maus + Tastatur** (kein Touch-Design!)
- **Kleine, präzise Klickbereiche** (keine großen Touch-Targets)
- **Hover-States** für alle interaktiven Elemente
- **Keyboard-Shortcuts** für Power-User

### Performance
- **Smooth Scrolling** in Sidebar
- **Lazy Loading** für Karten-Inhalte
- **Optimistic Updates** bei Tab-Wechsel

### Accessibility
- **Kontrast-Verhältnis** mind. 4.5:1 für Text
- **Focus-States** sichtbar (lila Ring)
- **Keyboard-Navigation** vollständig

---

## 6. Geplante Features (für Design-Planung)

### v0.1 (aktuell)
- ✅ Profile-Wechsel
- ✅ Karten-Liste
- ✅ Karopapier-Canvas (statisch)
- ⏳ React Flow Integration
- ⏳ ApiChatWindow (erste Karte)
- ⏳ Router-Lite (Free-API)

### v0.2 (nächste Phase)
- WebChatWindow (Browser-Sessions)
- Fenster-MCP (Agentensteuerung)
- Git-Integration (Branches pro Karte)
- Review/Debug-Workflow

### v0.3 (später)
- Gruppen-System
- Memory-Store
- Rollen-Templates
- Vollständiger Tisch-MCP

---

## 7. Design-Fragen für die KI

### Offene Entscheidungen
1. **Karten-Design:** Wie sehen ChatWindow/Notiz-Karten aus? Größe? Header? Controls?
2. **Verbindungen:** Wie werden Edges zwischen Karten visualisiert?
3. **Kontext-Menüs:** Rechtsklick auf Karten → welche Optionen?
4. **Status-Indikatoren:** Wie zeigen wir "lädt", "Fehler", "suspended"?
5. **Suche/Filter:** Wie findet man Karten auf einem unendlichen Tisch?
6. **Zoom-Levels:** Welche Details sind auf welcher Zoom-Stufe sichtbar?
7. **Minimap:** Brauchen wir eine Übersichtskarte?
8. **Toolbar:** Brauchen wir zusätzliche Tools (Auswahl, Text, etc.)?

### Design-Prinzipien
- **"Echter Kartentisch"** – physisch, haptisch, wie alte Karten
- **PC-optimiert** – Maus + Tastatur, keine Touch-Blob-UI
- **Schlicht & übersichtlich** – kein Material Design, keine modernen Trends
- **Funktional** – Form follows function

---

## 8. Farbpalette (aktuell)

```css
/* Hauptfarben */
--paper: #F2EAD3;           /* Karopapier-Hintergrund */
--paper-dark: #E8DCC4;      /* Sidebar, Topbar */
--ink: #2B2B28;             /* Haupttext */
--ink-light: #4A4A47;       /* Sekundärtext */

/* Akzente */
--accent-red: #C4453B;      /* Warnungen, Delete */
--accent-purple: #8B5CF6;   /* Primär-Akzent, Focus */

/* Grid */
--grid-line: #D4C5A9;       /* Karo-Linien */
```

---

## 9. Export für Design-Tool

### Komponenten-Liste
1. `Topbar` – Header mit Logo + Aktionen
2. `Sidebar` – Navigation (Profile + Karten)
3. `Canvas` – Hauptbereich (React Flow)
4. `FloatingBar` – Status-Anzeige
5. `Card` – Basis-Karte (ChatWindow, Notiz, etc.)
6. `Button` – Primär, Sekundär, Danger
7. `Input` – Text, Search, Number
8. `Modal` – Dialoge, Settings
9. `Dropdown` – Menüs, Auswahl
10. `Tooltip` – Hover-Info

### Assets benötigt
- Icons (Lucide oder custom)
- Fonts (Inter, JetBrains Mono, Caveat)
- Texturen (Karopapier, Schatten)
- Cursor-States (default, pointer, grab, etc.)

---

## 10. Nächste Schritte

1. **Design-Entwürfe** für die 10 Komponenten oben
2. **React Flow Integration** – Canvas mit Nodes
3. **Erste Karten-Typen** – ChatWindow + Notiz
4. **Router-Lite UI** – Provider-Auswahl, Status
5. **Git-Loop UI** – Branch-Anzeige, Commit-History

---

**Kontakt:** Diese Spezifikation ist die Grundlage für das UI-Design. Alle Komponenten müssen mit diesen Schnittstellen kompatibel sein.
