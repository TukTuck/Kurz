// Mock API for browser preview (without Electron)
// This provides a minimal implementation of window.api to allow the UI to render

(function() {
  console.log('[Mock API] Initializing browser mock for MashAI...');

  const mockProfiles = [
    { id: 'work', name: 'Work', icon: 'Briefcase', color: '#8b5cf6' },
    { id: 'personal', name: 'Personal', icon: 'User', color: '#3b82f6' },
    { id: 'research', name: 'Research', icon: 'BookOpen', color: '#10b981' }
  ];

  const mockProviders = [
    { id: 'chatgpt', name: 'ChatGPT', url: 'https://chat.openai.com', enabled: true },
    { id: 'claude', name: 'Claude', url: 'https://claude.ai', enabled: true },
    { id: 'gemini', name: 'Gemini', url: 'https://gemini.google.com', enabled: true },
    { id: 'perplexity', name: 'Perplexity', url: 'https://perplexity.ai', enabled: true },
    { id: 'grok', name: 'Grok', url: 'https://grok.x.ai', enabled: true },
    { id: 'deepseek', name: 'DeepSeek', url: 'https://chat.deepseek.com', enabled: true }
  ];

  const mockSettings = {
    aiProviders: mockProviders,
    defaultProviderId: 'perplexity',
    performance: {
      tabLoadingStrategy: 'lastActiveOnly',
      autoSuspendEnabled: true,
      autoSuspendMinutes: 30,
      profileSwitchBehavior: 'suspend',
      suspendOnHide: true,
      keepLastActiveTab: true,
      suspendDelaySeconds: 5
    },
    general: {
      hardwareAcceleration: true,
      rememberWindowPosition: true,
      launchAtStartup: false,
      alwaysOnTop: false
    },
    shortcuts: {},
    privacy: {
      adBlockEnabled: true
    }
  };

  let mockTabs = [];
  let activeTabId = null;

  // Create initial tab on startup
  const initialTab = {
    id: 'tab-initial',
    profileId: 'work',
    url: 'https://perplexity.ai',
    title: 'Perplexity',
    loaded: true,
    suspended: false,
    faviconDataUrl: 'https://www.google.com/s2/favicons?domain=perplexity.ai&sz=32'
  };
  mockTabs.push(initialTab);
  activeTabId = initialTab.id;

  window.api = {
    // Window Controls (no-op in browser)
    minimize: () => console.log('[Mock] minimize'),
    maximize: () => console.log('[Mock] maximize'),
    close: () => console.log('[Mock] close'),
    hideWebView: () => {},
    showWebView: () => {},

    // Tab Actions
    createTab: (profileId) => {
      console.log('[Mock] createTab for profile:', profileId);
      const newTab = {
        id: `tab-${Date.now()}`,
        profileId,
        url: 'https://perplexity.ai',
        title: 'New Tab',
        loaded: true,
        suspended: false,
        faviconDataUrl: 'https://www.google.com/s2/favicons?domain=perplexity.ai&sz=32'
      };
      mockTabs.push(newTab);
      activeTabId = newTab.id;
      return Promise.resolve(newTab);
    },
    createTabWithUrl: (profileId, url) => {
      console.log('[Mock] createTabWithUrl:', { profileId, url });
      return Promise.resolve();
    },
    switchTab: (tabId) => {
      console.log('[Mock] switchTab:', tabId);
      activeTabId = tabId;
    },
    closeTab: (tabId) => {
      console.log('[Mock] closeTab:', tabId);
      mockTabs = mockTabs.filter(t => t.id !== tabId);
    },
    duplicateTab: (tabId) => console.log('[Mock] duplicateTab:', tabId),
    reloadTab: (tabId) => console.log('[Mock] reloadTab:', tabId),
    reopenClosedTab: () => console.log('[Mock] reopenClosedTab'),
    closeOtherTabs: (tabId, profileId) => console.log('[Mock] closeOtherTabs:', { tabId, profileId }),
    closeTabsToRight: (tabId, profileId) => console.log('[Mock] closeTabsToRight:', { tabId, profileId }),
    reorderTabs: (tabOrder) => console.log('[Mock] reorderTabs:', tabOrder),

    // Profile
    getProfileTabs: (profileId) => console.log('[Mock] getProfileTabs:', profileId),
    switchProfile: (toProfileId) => console.log('[Mock] switchProfile:', toProfileId),
    getAllTabs: () => Promise.resolve({ tabs: mockTabs, activeTabId }),

    // Settings
    getSettings: () => Promise.resolve(mockSettings),
    saveSettings: (settings) => {
      console.log('[Mock] saveSettings:', settings);
      Object.assign(mockSettings, settings);
      return Promise.resolve(true);
    },
    deleteProfile: (profileId) => {
      console.log('[Mock] deleteProfile:', profileId);
      return Promise.resolve(true);
    },
    validateShortcut: (shortcut) => Promise.resolve(true),
    getActiveProfileId: () => Promise.resolve('work'),

    // Memory Usage
    getMemoryUsage: () => Promise.resolve({ workingSetSize: 0 }),
    getAllTabsMemory: () => Promise.resolve({}),

    // Navigation
    goBack: () => console.log('[Mock] goBack'),
    goForward: () => console.log('[Mock] goForward'),
    reload: () => console.log('[Mock] reload'),

    // Listeners (no-op, return cleanup functions)
    onProfilesLoaded: (callback) => {
      // Trigger immediately with mock data
      setTimeout(() => callback(mockProfiles), 100);
      return () => {};
    },
    onTabCreated: (callback) => () => {},
    onTabUpdated: (callback) => () => {},
    onTabLoading: (callback) => () => {},
    onRestoreActive: (callback) => () => {},
    onProfileTabsLoaded: (callback) => () => {},
    onWindowMaximized: (callback) => () => {},
    onRequestCloseTab: (callback) => () => {},
    onTabClosedBackend: (callback) => () => {},
    onSwitchProfileRequest: (callback) => () => {},
    onOpenSettingsModal: (callback) => () => {},
    onOpenTabSearch: (callback) => () => {},
    onShowToast: (callback) => () => {},
    onSettingsUpdated: (callback) => () => {},
    onProfileDeleted: (callback) => () => {},

    // Context Menu
    showContextMenu: (tabId) => console.log('[Mock] showContextMenu:', tabId),
    showProfileMenu: (x, y, activeProfileId) => console.log('[Mock] showProfileMenu:', { x, y, activeProfileId }),
    showNewTabMenu: (x, y, profileId) => console.log('[Mock] showNewTabMenu:', { x, y, profileId }),

    // Privacy & Data Management
    clearPrivacyData: (options) => {
      console.log('[Mock] clearPrivacyData:', options);
      return Promise.resolve(true);
    },

    // External Links
    openExternal: (url) => {
      console.log('[Mock] openExternal:', url);
      window.open(url, '_blank');
      return Promise.resolve();
    },

    // Downloads
    getDownloads: () => Promise.resolve([]),
    cancelDownload: (id) => Promise.resolve(),
    pauseDownload: (id) => Promise.resolve(),
    resumeDownload: (id) => Promise.resolve(),
    openDownload: (filePath) => Promise.resolve(),
    showDownloadInFolder: (filePath) => console.log('[Mock] showDownloadInFolder:', filePath),
    clearDownloadHistory: () => console.log('[Mock] clearDownloadHistory'),
    removeDownloadFromHistory: (id) => console.log('[Mock] removeDownloadFromHistory:', id),
    openDownloadsWindow: () => console.log('[Mock] openDownloadsWindow'),
    hideDownloadToast: () => {},
    selectDownloadFolder: () => Promise.resolve(null),
    onDownloadUpdate: (callback) => () => {},

    // Ad Blocker
    getAdBlockStatus: () => Promise.resolve({ enabled: true, rulesCount: 0 }),
    updateAdBlockLists: () => Promise.resolve(true),

    // Side Panel
    pinToSidePanel: (tabId, side) => console.log('[Mock] pinToSidePanel:', { tabId, side }),
    unpinSidePanel: () => console.log('[Mock] unpinSidePanel'),
    swapPanelSide: () => console.log('[Mock] swapPanelSide'),
    setPanelWidth: (width) => console.log('[Mock] setPanelWidth:', width),
    getSidePanelState: () => Promise.resolve(null),
    onSidePanelStateChanged: (callback) => () => {},
    onPulseSidePanel: (callback) => () => {},
    pulseSidePanel: () => console.log('[Mock] pulseSidePanel'),

    // Quick Search
    send: (channel, ...args) => console.log('[Mock] send:', channel, args),
    onQuickSearchFocus: (callback) => () => {}
  };

  console.log('[Mock API] Mock initialized successfully');
})();
