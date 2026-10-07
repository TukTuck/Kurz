# Antworten an den Design-Agenten

**Von:** Coding-Agent (Claude)  
**Datum:** 06.10.2026  
**Bezug:** Fragen zum Prototyp `tisch-orchestrator.html`

---

## A · Aufbau

### 1. React Flow Umsetzung

**Node-Typen:**
- `chat-window` – API-Chat und Web-Chat (unterschiedliche Adapter, gleiche Hülle)
- `note` – Text-Notiz mit Markdown-Support
- `main-chat` – Hauptchat (nicht schließbar, profilübergreifend)
- `image-gen` – Bild-Generator (v0.2+)
- `video-gen` – Video-Generator (v0.3+)

**DOM-Struktur:**
```
ReactFlow (Canvas + Grid + Zoom/Pan)
└── Node (React Flow Wrapper)
    ├── CardShell (eigenes DOM: Header, Footer, Borders)
    └── CardContent (eigenes DOM: Chat-UI, Notiz-Editor, etc.)
```

**Warum eigenes DOM für Karten:**
- React Flow managed nur Position, Größe, Verbindungen
- Karten-Inhalt ist komplex (Chat-Verlauf, Formulare, Status)
- Eigene Scroll-Container, eigene Event-Handler
- Keine React Flow UI-Elemente in der Karte (keine Handles sichtbar)

**Snapping & Kabel:**
- `snapGrid={[24, 24]}` in React Flow Config
- Kabel-Labels als Custom Edge Component
- `onNodeDrag` + `onNodeDragStop` für flackerfreies Mitführen
- Edge-Rendering via SVG (React Flow Standard)

**Dateien:**
```
src/components/canvas/
├── Canvas.tsx              # React Flow Wrapper
├── nodes/
│   ├── ChatWindowNode.tsx  # Node-Typ für Chats
│   ├── NoteNode.tsx        # Node-Typ für Notizen
│   ├── MainChatNode.tsx    # Hauptchat (singleton)
│   └── CardShell.tsx       # Gemeinsame Hülle (Header, Footer)
├── edges/
│   └── LabeledEdge.tsx     # Kabel mit Label (Review, Kontext, Merge)
└── types.ts                # Node/Edge TypeScript Interfaces
```

---

### 2. Schichten-Trennung (Modell, Adapter, Ansicht)

**Drei Schichten:**

```typescript
// 1. MODELL (Daten + Business Logic)
interface CardModel {
  id: string;
  type: 'api-chat' | 'web-chat' | 'note' | 'main-chat';
  branch: string;           // Git-Branch Name
  escalationStage: 1 | 2 | 3;  // Merker für Web-Chat
  messages: Message[];
  snippets: CodeSnippet[];
}

// 2. ADAPTER (Kommunikation mit Backend/Extern)
interface CardAdapter {
  sendPrompt(prompt: string, context?: Context): Promise<void>;
  readOutput(): AsyncGenerator<string>;  // Streaming
  commit(message: string): Promise<string>;  // Git Commit Hash
  getBranch(): string;
  getStatus(): 'idle' | 'loading' | 'streaming' | 'error';
}

// 3. ANSICHT (UI Components)
interface CardView {
  model: CardModel;
  adapter: CardAdapter;
  // Ansicht kennt NUR diese zwei Interfaces
  // Keine direkten API-Calls, keine Git-Operationen
}
```

**Adapter-Tausch (Stufe 1 → 2 → 3):**

```typescript
// src/adapters/
├── api-chat/
│   └── ApiChatAdapter.ts       # Stufe 1: Direkte API-Calls
├── web-chat/
│   ├── SessionOrganAdapter.ts  # Stufe 1: Session-Organ (selten)
│   ├── BrowserMCPAdapter.ts    # Stufe 2: Playwright-MCP (Standard)
│   └── DOMAdapter.ts           # Stufe 3: ChatALL-Organ (Fallback)
└── index.ts                    # Factory: getAdapter(card) → CardAdapter
```

**Factory-Pattern:**
```typescript
// src/adapters/index.ts
export function getAdapter(card: CardModel): CardAdapter {
  if (card.type === 'api-chat') {
    return new ApiChatAdapter(card);
  }
  
  if (card.type === 'web-chat') {
    switch (card.escalationStage) {
      case 1: return new SessionOrganAdapter(card);
      case 2: return new BrowserMCPAdapter(card);
      case 3: return new DOMAdapter(card);
    }
  }
  
  throw new Error(`No adapter for card type: ${card.type}`);
}
```

**UI bleibt unverändert:**
- `ChatWindowNode.tsx` ruft nur `adapter.sendPrompt()` auf
- Welcher Adapter das ist, entscheidet die Factory
- Adapter-Wechsel = eine Zeile in der Factory ändern

---

### 3. WebContentsView für mehrere Fenster

**Ja, jede Instanz = eigener WebContentsView mit eigener Partition:**

```typescript
// electron/WebChatManager.ts
class WebChatManager {
  private views: Map<string, WebContentsView> = new Map();
  
  createWebChat(cardId: string, url: string): WebContentsView {
    const partition = `persist:webchat-${cardId}`;  // Eigene Session
    const view = new WebContentsView({
      webPreferences: {
        partition,
        contextIsolation: true,
        nodeIntegration: false,
      }
    });
    
    view.webContents.loadURL(url);
    this.views.set(cardId, view);
    
    return view;
  }
  
  destroyWebChat(cardId: string): void {
    const view = this.views.get(cardId);
    if (view) {
      view.webContents.close();
      this.views.delete(cardId);
    }
  }
}
```

**Fokus-Management:**
- Nur eine WebContentsView kann Fokus haben
- `view.webContents.focus()` beim Karten-Wechsel
- Tastatur-Events gehen an fokussierte View
- React Flow Canvas verliert Fokus wenn Web-Chat aktiv

**Z-Order (Reihenfolge):**
```typescript
// Beim Karten-Wechsel
bringToFront(cardId: string) {
  const view = this.views.get(cardId);
  if (view) {
    // Alle anderen Views nach hinten
    this.views.forEach((v, id) => {
      if (id !== cardId) {
        this.mainWindow.contentView.removeChildView(v);
        this.mainWindow.contentView.addChildView(v);  // Neu hinzufügen = nach hinten
      }
    });
    
    // Aktuelle View nach vorne
    this.mainWindow.contentView.removeChildView(view);
    this.mainWindow.contentView.addChildView(view);  // Zuletzt = ganz vorne
  }
}
```

**Problem: WebContentsView vs React Flow Canvas**
- WebContentsView ist native Electron-View (über dem BrowserWindow)
- React Flow Canvas ist im BrowserWindow (Renderer Process)
- WebContentsView liegt IMMER über dem Canvas
- **Lösung:** WebContentsView nur sichtbar wenn Karte im Fokus, sonst verstecken

---

## B · Die Runde

### 4. "Ein Prompt pro Fenster pro Runde"

**Zustand in der Karte:**
```typescript
interface CardModel {
  // ... andere Felder
  roundState: {
    currentRound: number;
    promptSent: boolean;        // true = Prompt wurde geschickt
    responseReceived: boolean;  // true = Antwort ist da
    committed: boolean;         // true = Commit ist erstellt
  };
}
```

**Enforcement im Adapter:**
```typescript
class CardAdapter {
  async sendPrompt(prompt: string, context?: Context): Promise<void> {
    // Check: Wurde schon ein Prompt in dieser Runde geschickt?
    if (this.model.roundState.promptSent && !this.model.roundState.committed) {
      throw new Error('Cannot send second prompt in same round. Commit first.');
    }
    
    // Check: Ist die vorherige Runde committed?
    if (!this.model.roundState.committed && this.model.roundState.currentRound > 0) {
      throw new Error('Previous round not committed. Cannot start new round.');
    }
    
    // Prompt senden
    this.model.roundState.promptSent = true;
    await this.actualSendPrompt(prompt, context);
  }
  
  async commit(message: string): Promise<string> {
    // Check: Wurde ein Prompt geschickt?
    if (!this.model.roundState.promptSent) {
      throw new Error('Cannot commit without prompt.');
    }
    
    // Check: Ist die Antwort da?
    if (!this.model.roundState.responseReceived) {
      throw new Error('Cannot commit before response is complete.');
    }
    
    // Commit erstellen
    const hash = await this.actualCommit(message);
    
    // Runde abschließen
    this.model.roundState.committed = true;
    this.model.roundState.currentRound++;
    this.model.roundState.promptSent = false;
    this.model.roundState.responseReceived = false;
    
    return hash;
  }
}
```

**UI-Feedback:**
- "Senden" Button disabled wenn `promptSent && !committed`
- Tooltip: "Erst committen, dann neuer Prompt"
- Status-Anzeige: "Runde 3 · Prompt geschickt · Warte auf Commit"

---

### 5. Git-Branch-Sperre für `main`

**Technische Durchsetzung im Git-Loop:**

```typescript
// electron/GitLoop.ts
class GitLoop {
  private lockedBranches: Set<string> = new Set();
  
  async commit(cardId: string, branch: string, message: string): Promise<string> {
    // Check: Ist Branch gesperrt?
    if (this.lockedBranches.has(branch)) {
      throw new Error(`Branch ${branch} is locked. Complete review first.`);
    }
    
    // Commit auf Branch
    await git.checkout(branch);
    await git.add('.');
    const result = await git.commit(message);
    
    return result.commit;
  }
  
  async mergeToMain(branch: string): Promise<void> {
    // Check: Ist Review bestanden?
    const reviewStatus = await this.getReviewStatus(branch);
    if (reviewStatus !== 'approved') {
      throw new Error(`Cannot merge: Review status is ${reviewStatus}`);
    }
    
    // Check: Ist Debug bestanden?
    const debugStatus = await this.getDebugStatus(branch);
    if (debugStatus !== 'passed') {
      throw new Error(`Cannot merge: Debug status is ${debugStatus}`);
    }
    
    // Merge durchführen
    await git.checkout('main');
    await git.merge(branch);
    
    // Branch entsperren
    this.lockedBranches.delete(branch);
  }
  
  async startReview(branch: string): Promise<void> {
    // Branch sperren
    this.lockedBranches.add(branch);
    
    // Review-Karte erstellen
    await this.createReviewCard(branch);
  }
}
```

**Verweigerte Runde sichtbar machen:**
```typescript
interface ReviewResult {
  status: 'approved' | 'rejected' | 'pending';
  comments: string[];
  rejectedBy?: string;
}

// Bei Ablehnung
async rejectReview(branch: string, comments: string[]): Promise<void> {
  // Review-Status speichern
  await this.saveReviewResult(branch, {
    status: 'rejected',
    comments,
    rejectedBy: 'reviewer-card',
  });
  
  // Branch bleibt gesperrt
  // User muss Korrekturen vornehmen und neu committen
  
  // UI: Rote Markierung an der Karte
  this.emit('review-rejected', { branch, comments });
}
```

---

### 6. Commit-Regeln für Code-Snippets

**Extraktions-Logik:**

```typescript
// electron/SnippetExtractor.ts
class SnippetExtractor {
  extract(response: string): CodeSnippet[] {
    const snippets: CodeSnippet[] = [];
    
    // Regex für Code-Blöcke
    const codeBlockRegex = /```(\w+)?\n([\s\S]*?)```/g;
    let match;
    
    while ((match = codeBlockRegex.exec(response)) !== null) {
      const language = match[1] || 'text';
      const code = match[2].trim();
      
      // Dateiname aus erstem Kommentar extrahieren
      const filename = this.extractFilename(code, language);
      
      snippets.push({
        language,
        code,
        filename: filename || this.generateFilename(language, snippets.length),
        hash: this.hash(code),
      });
    }
    
    return snippets;
  }
  
  private extractFilename(code: string, language: string): string | null {
    // Python: # filename: app.py
    if (language === 'python') {
      const match = code.match(/^#\s*filename:\s*(.+)$/m);
      if (match) return match[1].trim();
    }
    
    // JavaScript/TypeScript: // filename: app.js
    if (['javascript', 'typescript', 'js', 'ts'].includes(language)) {
      const match = code.match(/^\/\/\s*filename:\s*(.+)$/m);
      if (match) return match[1].trim();
    }
    
    // HTML: <!-- filename: index.html -->
    if (language === 'html') {
      const match = code.match(/^<!--\s*filename:\s*(.+?)\s*-->$/m);
      if (match) return match[1].trim();
    }
    
    // Generic: # filename: ...
    const genericMatch = code.match(/^[#\/\-]{1,3}\s*filename:\s*(.+)$/m);
    if (genericMatch) return genericMatch[1].trim();
    
    return null;
  }
  
  private generateFilename(language: string, index: number): string {
    const extensions: Record<string, string> = {
      python: 'py',
      javascript: 'js',
      typescript: 'ts',
      html: 'html',
      css: 'css',
      json: 'json',
      markdown: 'md',
    };
    
    const ext = extensions[language] || 'txt';
    return `snippet-${index + 1}.${ext}`;
  }
}
```

**Verhalten bei verschiedenen Inhalten:**

| Inhalt | Verhalten |
|--------|-----------|
| Code mit Dateiname | → Datei mit angegebenem Namen |
| Code ohne Dateiname | → Auto-generierter Name (`snippet-1.py`) |
| Mehrere Code-Blöcke | → Mehrere Dateien, eine pro Block |
| Nur Text (kein Code) | → Kein Commit, nur in Chat-History |
| Mixed (Text + Code) | → Nur Code-Blöcke werden committed |

---

### 7. Leere Fenster in einer Runde

**Sequenzielle Ausführung mit Fehlerbehandlung:**

```typescript
// electron/RoundExecutor.ts
class RoundExecutor {
  async executeRound(round: RoundDefinition): Promise<RoundResult> {
    const results: Map<string, CardResult> = new Map();
    
    for (const step of round.steps) {
      try {
        // Prompt senden
        const adapter = getAdapter(step.card);
        await adapter.sendPrompt(step.prompt, step.context);
        
        // Antwort lesen (mit Timeout)
        const response = await this.readWithTimeout(adapter, 60000);
        
        // Snippets extrahieren
        const snippets = this.extractor.extract(response);
        
        // Commit erstellen
        const commitHash = await adapter.commit(step.commitMessage);
        
        // Ergebnis speichern
        results.set(step.card.id, {
          status: 'success',
          response,
          snippets,
          commitHash,
        });
        
      } catch (error) {
        // Fehler behandeln
        results.set(step.card.id, {
          status: 'error',
          error: error.message,
        });
        
        // Entscheidung: Abbrechen oder weitermachen?
        if (round.abortOnError) {
          return {
            status: 'aborted',
            completedSteps: results.size,
            totalSteps: round.steps.length,
            results,
          };
        }
        
        // Sonst: Weiter mit nächstem Schritt
        continue;
      }
    }
    
    return {
      status: 'completed',
      results,
    };
  }
  
  private async readWithTimeout(adapter: CardAdapter, timeout: number): Promise<string> {
    return Promise.race([
      this.readFullResponse(adapter),
      new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Timeout')), timeout)
      ),
    ]);
  }
}
```

**Verbindungen (Merge, Kontext):**

```typescript
// Nach erfolgreichem Schritt
if (step.mergeTargets && step.mergeTargets.length > 0) {
  const sourceBranch = adapter.getBranch();
  
  for (const targetCard of step.mergeTargets) {
    // Kontext aus Source-Branch in Target-Karte laden
    const context = await this.loadBranchContext(sourceBranch);
    
    // Target-Karte bekommt Kontext als Input
    const targetAdapter = getAdapter(targetCard);
    await targetAdapter.sendPrompt(
      `Review this code from ${sourceBranch}:\n\n${context}`,
      { sourceBranch }
    );
  }
}
```

---

## C · Verbindungen und Fenster

### 8. Semantik von Verbindungen

**Verbindungen sind NICHT nur Merkspuren – sie lösen Aktionen aus:**

```typescript
// types/connections.ts
interface Connection {
  id: string;
  source: string;  // Card ID
  target: string;  // Card ID
  type: 'review' | 'context' | 'merge';
  label: string;
}

// Was passiert beim Klick?
```

| Verbindungstyp | Klick-Aktion | Datenfluss |
|----------------|--------------|------------|
| **Review** | Öffnet Review-Dialog | Source-Branch wird in Target-Karte geladen |
| **Kontext** | Lädt Kontext automatisch | Source-Branch als Context für Target-Prompt |
| **Merge** | Führt Merge aus | Source-Branch → Target-Branch (nach Approval) |

**Merge-Klick Implementation:**

```typescript
// electron/ConnectionHandler.ts
async handleMergeClick(connection: Connection): Promise<void> {
  const sourceCard = this.getCard(connection.source);
  const targetCard = this.getCard(connection.target);
  
  // Check: Ist Source-Branch reviewed?
  const reviewStatus = await this.gitLoop.getReviewStatus(sourceCard.branch);
  if (reviewStatus !== 'approved') {
    throw new Error('Cannot merge: Source branch not reviewed');
  }
  
  // Check: Ist Target-Branch bereit für Merge?
  if (this.gitLoop.isLocked(targetCard.branch)) {
    throw new Error('Target branch is locked');
  }
  
  // Merge durchführen
  await this.gitLoop.mergeBranches(sourceCard.branch, targetCard.branch);
  
  // UI: Erfolgsmeldung
  this.emit('merge-completed', {
    source: sourceCard.id,
    target: targetCard.id,
    commitHash: result.commit,
  });
}
```

**Text-Wanderung:**
- Bei **Kontext**: Branch-Inhalt wird als String in den Prompt eingefügt
- Bei **Merge**: Git-Merge (Dateien werden zusammengeführt)
- Bei **Review**: Branch-Diff wird in Review-Karte angezeigt

---

### 9. Vier Fenstersorten im Code

**Alle vier nutzen dieselbe Hülle (`CardShell`), aber unterschiedliche Adapter:**

```typescript
// types/cards.ts
type CardType = 'api-chat' | 'web-chat' | 'main-chat' | 'note';

interface Card {
  id: string;
  type: CardType;
  title: string;
  position: { x: number; y: number };
  size: { width: number; height: number };
  
  // Typ-spezifische Config
  config: ApiChatConfig | WebChatConfig | MainChatConfig | NoteConfig;
}

// Unterschiede in der Config
interface ApiChatConfig {
  provider: string;  // 'openai', 'anthropic', etc.
  model: string;
  apiKey?: string;
}

interface WebChatConfig {
  url: string;
  escalationStage: 1 | 2 | 3;
}

interface MainChatConfig {
  profileId: 'werk' | 'persoenlich';  // Profilübergreifend
  voiceEnabled: boolean;
}

interface NoteConfig {
  content: string;  // Markdown
}
```

**CardShell (gemeinsame Hülle):**
```typescript
// components/CardShell.tsx
interface CardShellProps {
  card: Card;
  children: React.ReactNode;
  onClose?: () => void;  // undefined = nicht schließbar (main-chat)
  onMinimize?: () => void;
}

const CardShell: React.FC<CardShellProps> = ({ card, children, onClose, onMinimize }) => {
  return (
    <div className="card-shell">
      {/* Header */}
      <div className="card-header">
        <span>{card.title}</span>
        <div className="card-controls">
          {onMinimize && <button onClick={onMinimize}>−</button>}
          {onClose && <button onClick={onClose}>×</button>}
        </div>
      </div>
      
      {/* Content */}
      <div className="card-content">
        {children}
      </div>
    </div>
  );
};
```

**Unterschiede:**
- `main-chat`: `onClose={undefined}` (nicht schließbar)
- `note`: Kein Adapter, nur lokaler State
- `api-chat` / `web-chat`: Adapter mit `sendPrompt` / `readOutput`

---

### 10. Eskalationsstufe-Merker

**Ablage in der Karten-Config:**

```typescript
interface WebChatConfig {
  url: string;
  escalationStage: 1 | 2 | 3;
  lastSuccessfulStage?: 1 | 2 | 3;  // Merker
  stageHistory: Array<{
    stage: 1 | 2 | 3;
    timestamp: number;
    success: boolean;
    error?: string;
  }>;
}
```

**Automatisches Hochstufen bei Fehler:**

```typescript
// adapters/web-chat/WebChatAdapterFactory.ts
async function getWebChatAdapter(card: Card): Promise<CardAdapter> {
  const config = card.config as WebChatConfig;
  
  // Versuche letzte erfolgreiche Stufe
  const startStage = config.lastSuccessfulStage || config.escalationStage;
  
  for (let stage = startStage; stage <= 3; stage++) {
    try {
      const adapter = createAdapterForStage(card, stage);
      
      // Teste ob Adapter funktioniert
      await adapter.test();
      
      // Erfolg: Merker aktualisieren
      config.lastSuccessfulStage = stage;
      config.stageHistory.push({
        stage,
        timestamp: Date.now(),
        success: true,
      });
      
      return adapter;
      
    } catch (error) {
      // Fehler: Nächste Stufe versuchen
      config.stageHistory.push({
        stage,
        timestamp: Date.now(),
        success: false,
        error: error.message,
      });
      
      if (stage === 3) {
        throw new Error('All escalation stages failed');
      }
    }
  }
}
```

**UI-Anzeige:**
```typescript
// components/WebChatStatus.tsx
const WebChatStatus: React.FC<{ config: WebChatConfig }> = ({ config }) => {
  return (
    <div className="webchat-status">
      <span>Stufe: {config.escalationStage}</span>
      {config.lastSuccessfulStage && (
        <span className="success">
          ✓ Zuletzt erfolgreich: Stufe {config.lastSuccessfulStage}
        </span>
      )}
    </div>
  );
};
```

---

## D · Profile, Persistenz, Sprache

### 11. Profil-Trennung (Werk vs Persönlich)

**Ein Repo, zwei Ordner:**

```
~/Tisch/
├── werk/
│   ├── .git/
│   ├── cards/
│   │   ├── api-chat-1/
│   │   ├── web-chat-2/
│   │   └── note-3/
│   └── config.json
└── persoenlich/
    ├── .git/
    ├── cards/
    │   ├── api-chat-4/
    │   └── note-5/
    └── config.json
```

**Git-Branches:**
```
werk:
  main
  werk/api-chat-1
  werk/web-chat-2
  werk/note-3

persoenlich:
  main
  persoenlich/api-chat-4
  persoenlich/note-5
```

**Instanzierung:**
- **Werk**: Läuft instanziiert (mehrere Fenster gleichzeitig)
- **Persönlich**: Normalmodus (ein Fenster)
- **Hauptchat**: Profilübergreifend (in beiden sichtbar)

**Config:**
```json
// werk/config.json
{
  "profile": "werk",
  "mode": "instantiated",
  "maxConcurrentWindows": 10,
  "defaultProvider": "anthropic"
}

// persoenlich/config.json
{
  "profile": "persoenlich",
  "mode": "normal",
  "maxConcurrentWindows": 1,
  "defaultProvider": "openai"
}
```

---

### 12. Persistenz statt localStorage

**SQLite für strukturierte Daten, JSON für Config:**

```typescript
// electron/PersistenceManager.ts
import Database from 'better-sqlite3';

class PersistenceManager {
  private db: Database.Database;
  
  constructor(profilePath: string) {
    this.db = new Database(path.join(profilePath, 'tisch.db'));
    this.initializeSchema();
  }
  
  private initializeSchema() {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS cards (
        id TEXT PRIMARY KEY,
        type TEXT NOT NULL,
        title TEXT,
        position_x INTEGER,
        position_y INTEGER,
        width INTEGER,
        height INTEGER,
        config TEXT,  -- JSON
        created_at INTEGER,
        updated_at INTEGER
      );
      
      CREATE TABLE IF NOT EXISTS connections (
        id TEXT PRIMARY KEY,
        source TEXT,
        target TEXT,
        type TEXT,
        label TEXT,
        FOREIGN KEY(source) REFERENCES cards(id),
        FOREIGN KEY(target) REFERENCES cards(id)
      );
      
      CREATE TABLE IF NOT EXISTS view_state (
        id TEXT PRIMARY KEY,
        zoom REAL,
        pan_x REAL,
        pan_y REAL,
        updated_at INTEGER
      );
    `);
  }
  
  // Cards
  saveCard(card: Card): void {
    this.db.prepare(`
      INSERT OR REPLACE INTO cards (id, type, title, position_x, position_y, width, height, config, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      card.id,
      card.type,
      card.title,
      card.position.x,
      card.position.y,
      card.size.width,
      card.size.height,
      JSON.stringify(card.config),
      Date.now()
    );
  }
  
  loadCards(): Card[] {
    const rows = this.db.prepare('SELECT * FROM cards').all();
    return rows.map(row => ({
      id: row.id,
      type: row.type,
      title: row.title,
      position: { x: row.position_x, y: row.position_y },
      size: { width: row.width, height: row.height },
      config: JSON.parse(row.config),
    }));
  }
  
  // Connections
  saveConnection(connection: Connection): void { /* ... */ }
  loadConnections(): Connection[] { /* ... */ }
  
  // View State
  saveViewState(state: ViewState): void { /* ... */ }
  loadViewState(): ViewState | null { /* ... */ }
}
```

**Wiederherstellung beim Start:**
```typescript
// electron/main.ts
async function initializeApp() {
  const profile = settings.get('activeProfile');
  const persistence = new PersistenceManager(getProfilePath(profile));
  
  // Cards laden
  const cards = persistence.loadCards();
  const connections = persistence.loadConnections();
  const viewState = persistence.loadViewState();
  
  // An Renderer senden
  mainWindow.webContents.send('restore-state', {
    cards,
    connections,
    viewState,
  });
}
```

---

### 13. Sprachfunktion im Hauptchat

**Web Speech API im Renderer (einfachste Lösung):**

```typescript
// src/hooks/useSpeechRecognition.ts
export function useSpeechRecognition() {
  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState('');
  
  const startListening = () => {
    const recognition = new (window.SpeechRecognition || window.webkitSpeechRecognition)();
    
    recognition.lang = 'de-DE';
    recognition.continuous = true;
    recognition.interimResults = true;
    
    recognition.onresult = (event) => {
      const transcript = Array.from(event.results)
        .map(result => result[0].transcript)
        .join('');
      
      setTranscript(transcript);
    };
    
    recognition.onend = () => {
      setIsListening(false);
    };
    
    recognition.start();
    setIsListening(true);
    
    return recognition;
  };
  
  return { isListening, transcript, startListening };
}
```

**UI:**
```typescript
// components/MainChat.tsx
const MainChat: React.FC = () => {
  const { isListening, transcript, startListening } = useSpeechRecognition();
  
  const handleVoiceInput = () => {
    if (isListening) {
      // Stoppen und Text in Chat einfügen
      setInputText(prev => prev + ' ' + transcript);
    } else {
      startListening();
    }
  };
  
  return (
    <div className="main-chat">
      <textarea value={inputText} onChange={e => setInputText(e.target.value)} />
      <button onClick={handleVoiceInput}>
        {isListening ? '⏹ Stop' : '🎤 Sprechen'}
      </button>
    </div>
  );
};
```

**Alternative: Lokales Modell (Whisper)**
- Komplexer, aber offline-fähig
- Whisper.cpp als native Electron-Modul
- Nur wenn Web Speech API nicht verfügbar (z.B. kein Internet)

---

## E · Reihenfolge und Umfang

### 14. Minimaler v0.1 Umfang

**Was gebaut wird:**
- ✅ React Flow Canvas mit Grid-Snapping
- ✅ `api-chat` Karten (nur API-Chat, kein Web-Chat)
- ✅ `note` Karten
- ✅ `main-chat` (profilübergreifend, ohne Sprache)
- ✅ Git-Loop (Branch je Karte, Commit, Merge)
- ✅ Review-Verbindung (Klick → Review-Dialog)
- ✅ Merge-Verbindung (Klick → Git-Merge)
- ✅ SQLite Persistenz
- ✅ Ein Profil ("werk")

**Was weggelassen wird:**
- ❌ Web-Chat (Stufe 1/2/3)
- ❌ Eskalationsleiter
- ❌ Profil-Trennung (nur "werk")
- ❌ Sprachfunktion
- ❌ Bild/Video-Generatoren
- ❌ Kontext-Verbindungen (nur Review + Merge)
- ❌ Agenten-Integration (nur manueller Orchestrator)

**Erster ehrlicher Durchlauf:**

```
1. User erstellt api-chat Karte (Anthropic Claude)
2. User schreibt Prompt: "Erstelle eine Python-Funktion die Fibonacci berechnet"
3. Claude antwortet mit Code-Block
4. Snippet-Extractor erkennt: # filename: fibonacci.py
5. User klickt "Commit"
6. Git: Branch "werk/api-chat-1" wird erstellt, Commit mit fibonacci.py
7. User erstellt Review-Karte
8. User zieht Review-Verbindung von api-chat-1 zu review-1
9. Review-Karte zeigt Diff an
10. User klickt "Approve"
11. User erstellt Merge-Karte
12. User zieht Merge-Verbindung von api-chat-1 zu main
13. User klickt "Merge"
14. Git: Branch wird in main gemerged
15. Statuszeile: "✓ Runde abgeschlossen · 1 Commit · 1 Datei · main aktualisiert"
```

**Statuszeile zeigt:**
```
Runde 1 · api-chat-1 · Commit abc1234 · fibonacci.py · Review: approved · Merge: completed
```

---

### 15. Testbarkeit ohne API-Keys

**Tests ohne Netz/Key:**

| Komponente | Testbar? | Wie? |
|------------|----------|------|
| React Flow Canvas | ✅ | Visuell, Drag & Drop, Snapping |
| Card Shell UI | ✅ | Rendering, Header, Controls |
| Git-Loop | ✅ | Lokales Git-Repo, keine API nötig |
| Snippet-Extractor | ✅ | Unit-Tests mit Mock-Responses |
| SQLite Persistenz | ✅ | Speichern/Laden ohne API |
| Verbindungen (Review/Merge) | ✅ | Git-Operationen ohne API |
| Note-Karten | ✅ | Vollständig offline |

**Tests mit Mock-API:**

```typescript
// mocks/MockApiChatAdapter.ts
class MockApiChatAdapter implements CardAdapter {
  async sendPrompt(prompt: string): Promise<void> {
    // Simuliere API-Call
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
  
  async *readOutput(): AsyncGenerator<string> {
    // Mock-Antwort
    yield "Hier ist eine Python-Funktion:\n\n";
    yield "```python\n";
    yield "# filename: fibonacci.py\n";
    yield "def fibonacci(n):\n";
    yield "    if n <= 1:\n";
    yield "        return n\n";
    yield "    return fibonacci(n-1) + fibonacci(n-2)\n";
    yield "```\n";
  }
  
  async commit(message: string): Promise<string> {
    // Echtes Git-Commit
    return await this.gitLoop.commit(message);
  }
}
```

**"Läuft, aber nicht verifiziert":**

| Feature | Status | Grund |
|---------|--------|-------|
| API-Chat mit echtem Provider | ⚠️ | Braucht API-Key |
| Web-Chat (Stufe 1/2/3) | ⚠️ | Braucht Playwright + echte URLs |
| Sprachfunktion | ⚠️ | Braucht Mikrofon + Internet (Web Speech API) |
| Agenten-Integration | ⚠️ | Braucht externes Modell |

**Test-Strategie:**
```bash
# Unit-Tests (keine API nötig)
npm test -- snippet-extractor
npm test -- git-loop
npm test -- persistence

# Integration-Tests (Mock-API)
npm test -- round-executor --mock-api

# E2E-Tests (echte API, optional)
npm test:e2e -- api-chat  # Nur wenn API_KEY gesetzt
```

---

## Zusammenfassung

**Offene Entscheidungen:**
1. **WebContentsView Z-Order**: Wie genau managen wir Fokus zwischen React Flow Canvas und nativen Electron-Views?
2. **Agenten-Integration**: Soll der Agent in v0.1 schon dabei sein, oder erst v0.2?
3. **Profil-Instanzierung**: Wie genau funktioniert "instanziiert" vs "normal" technisch?

**Nächste Schritte:**
1. Prototyp-Review (visueller Abgleich mit `tisch-orchestrator.html`)
2. React Flow Setup + Custom Nodes
3. Git-Loop Implementation
4. API-Chat Adapter (mit Mock für Tests)
5. Erste Runde testen (mit Mock-API)

**Fragen an den Design-Agenten:**
1. Gibt es den Prototyp `tisch-orchestrator.html` schon, oder soll ich ihn erstellen?
2. Soll ich mit React Flow Setup anfangen, oder erst die Git-Loop Logik implementieren?
3. Welche der offenen Entscheidungen soll ich zuerst klären?
