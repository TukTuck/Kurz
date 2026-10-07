import { useState, useEffect } from 'react'
import type { Profile, TabInfo } from './types'

function App() {
    const [profiles, setProfiles] = useState<Profile[]>([])
    const [tabs, setTabs] = useState<TabInfo[]>([])
    const [activeProfileId, setActiveProfileId] = useState<string>('work')
    const [activeTabId, setActiveTabId] = useState<string | null>(null)

    useEffect(() => {
        if (!window.api) {
            console.error('window.api is undefined')
            return
        }

        const loadData = async () => {
            try {
                const { tabs: loadedTabs, activeTabId: loadedActiveId } = await window.api.getAllTabs()
                if (loadedTabs) {
                    setTabs(loadedTabs)
                    setActiveTabId(loadedActiveId)
                }
            } catch (err) {
                console.error('Failed to load tabs:', err)
            }
        }

        loadData()

        const cleanupProfiles = window.api.onProfilesLoaded((loadedProfiles) => {
            setProfiles(loadedProfiles)
        })

        return () => {
            cleanupProfiles()
        }
    }, [])

    const currentTabs = tabs.filter(t => t.profileId === activeProfileId)
    const activeTab = tabs.find(t => t.id === activeTabId)

    const switchProfile = (profileId: string) => {
        setActiveProfileId(profileId)
        const profileTabs = tabs.filter(t => t.profileId === profileId)
        if (profileTabs.length > 0) {
            setActiveTabId(profileTabs[0].id)
        } else {
            setActiveTabId(null)
        }
    }

    return (
        <div className="h-screen w-screen bg-paper flex flex-col overflow-hidden">
            {/* Topbar */}
            <div className="tisch-topbar h-12 flex items-center px-4 gap-4">
                <div className="flex items-center gap-2">
                    <div className="w-8 h-8 bg-accent-purple rounded flex items-center justify-center text-white font-bold text-sm">
                        T
                    </div>
                    <span className="font-semibold text-ink">TISCH</span>
                </div>
                
                <div className="h-6 w-px bg-grid-line" />
                
                <button className="tisch-button text-xs">
                    + Neue Karte
                </button>
                
                <div className="flex-1" />
                
                <div className="text-xs text-ink-light">
                    {profiles.length} Profile · {tabs.length} Karten
                </div>
            </div>

            <div className="flex flex-1 overflow-hidden">
                {/* Sidebar links */}
                <div className="tisch-sidebar w-64 flex flex-col overflow-hidden">
                    <div className="p-4 border-b border-grid-line">
                        <h2 className="text-xs font-semibold text-ink-light uppercase tracking-wide mb-3">
                            Profile
                        </h2>
                        <div className="space-y-1">
                            {profiles.map(profile => (
                                <button
                                    key={profile.id}
                                    onClick={() => switchProfile(profile.id)}
                                    className={`w-full text-left px-3 py-2 rounded text-sm transition-colors ${
                                        profile.id === activeProfileId
                                            ? 'bg-paper text-ink font-medium'
                                            : 'text-ink-light hover:bg-paper/50'
                                    }`}
                                >
                                    {profile.name || profile.id}
                                </button>
                            ))}
                        </div>
                    </div>
                    
                    <div className="p-4 flex-1 overflow-y-auto">
                        <h2 className="text-xs font-semibold text-ink-light uppercase tracking-wide mb-3">
                            Karten ({currentTabs.length})
                        </h2>
                        <div className="space-y-1">
                            {currentTabs.map(tab => (
                                <button
                                    key={tab.id}
                                    onClick={() => setActiveTabId(tab.id)}
                                    className={`w-full text-left px-3 py-2 rounded text-xs transition-colors ${
                                        tab.id === activeTabId
                                            ? 'bg-paper text-ink'
                                            : 'text-ink-light hover:bg-paper/50'
                                    }`}
                                >
                                    <div className="font-medium truncate">{tab.title || 'Unbenannt'}</div>
                                    <div className="text-[10px] text-ink-light/60 truncate mt-0.5">{tab.url}</div>
                                </button>
                            ))}
                        </div>
                    </div>
                </div>

                {/* Hauptbereich - Karopapier-Tisch */}
                <div className="flex-1 relative paper-grid overflow-hidden">
                    {/* Placeholder für React Flow Canvas */}
                    <div className="absolute inset-0 flex items-center justify-center">
                        <div className="text-center max-w-md">
                            <div className="tisch-card p-8 rounded-lg mb-4">
                                <h1 className="text-2xl font-bold text-ink mb-2">Willkommen bei TISCH</h1>
                                <p className="text-sm text-ink-light mb-4">
                                    Dein unendlicher Kartentisch für AI-Workflows
                                </p>
                                <div className="text-xs text-ink-light/60">
                                    React Flow Canvas wird hier geladen...
                                </div>
                            </div>
                            
                            {activeTab && (
                                <div className="tisch-card p-4 rounded text-left">
                                    <h3 className="font-semibold text-sm text-ink mb-2">Aktive Karte</h3>
                                    <div className="text-xs font-medium text-ink">{activeTab.title}</div>
                                    <a href={activeTab.url} target="_blank" rel="noopener noreferrer" 
                                       className="text-xs text-accent-purple hover:underline">
                                        {activeTab.url}
                                    </a>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Schwebende Leiste unten */}
                    <div className="absolute bottom-4 left-4 right-4 md:right-auto md:w-96">
                        <div className="tisch-floating-bar rounded-lg p-3">
                            <div className="flex items-center gap-3 text-xs">
                                <div className="flex-1">
                                    <div className="font-medium text-ink">Status</div>
                                    <div className="text-ink-light text-[10px]">
                                        Router: Bereit · Git: Lokal · MCP: Inaktiv
                                    </div>
                                </div>
                                <button className="tisch-button text-[10px]">
                                    Details
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}

export default App
