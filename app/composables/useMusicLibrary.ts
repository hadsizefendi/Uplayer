export interface Playlist {
    id: string
    name: string
    songIds: string[]
    createdAt: number
    updatedAt: number
}

export interface MusicLibrary {
    favorites: string[]
    recentSongs: string[]
    playlists: Playlist[]
}

/**
 * Music Library - Favorites, Playlists, Recent songs
 * Uses localStorage for browser, Tauri Store for desktop
 */
export function useMusicLibrary() {
    const favorites = ref<string[]>([])
    const recentSongs = ref<string[]>([])
    const playlists = ref<Playlist[]>([])
    const isInitialized = ref(false)

    // Storage key
    const STORAGE_KEY = 'uplayer_music_library'

    // Check if running in Tauri
    const isTauri = computed(() => typeof window !== 'undefined' && '__TAURI__' in window)

    // Dynamic store instance
    let tauriStore: any = null

    /**
     * Initialize the library
     */
    async function init() {
        if (isInitialized.value) return

        if (isTauri.value) {
            try {
                const { load } = await import('@tauri-apps/plugin-store')
                tauriStore = await load('music-library.json')
                await loadFromTauriStore()
            } catch (e) {
                console.warn('Tauri Store not available, using localStorage:', e)
                loadFromLocalStorage()
            }
        } else {
            loadFromLocalStorage()
        }

        isInitialized.value = true
    }

    /**
     * Load from Tauri Store
     */
    async function loadFromTauriStore() {
        if (!tauriStore) return

        try {
            const data = await tauriStore.get(STORAGE_KEY) as MusicLibrary | null
            if (data) {
                favorites.value = data.favorites || []
                recentSongs.value = data.recentSongs || []
                playlists.value = data.playlists || []
            }
        } catch (e) {
            console.error('Failed to load from Tauri Store:', e)
        }
    }

    /**
     * Load from localStorage
     */
    function loadFromLocalStorage() {
        if (typeof window === 'undefined') return

        try {
            const data = localStorage.getItem(STORAGE_KEY)
            if (data) {
                const parsed = JSON.parse(data) as MusicLibrary
                favorites.value = parsed.favorites || []
                recentSongs.value = parsed.recentSongs || []
                playlists.value = parsed.playlists || []
            }
        } catch (e) {
            console.error('Failed to load from localStorage:', e)
        }
    }

    /**
     * Save library data
     */
    async function save() {
        const data: MusicLibrary = {
            favorites: favorites.value,
            recentSongs: recentSongs.value,
            playlists: playlists.value
        }

        if (tauriStore) {
            try {
                await tauriStore.set(STORAGE_KEY, data)
                await tauriStore.save()
            } catch (e) {
                console.error('Failed to save to Tauri Store:', e)
            }
        } else if (typeof window !== 'undefined') {
            try {
                localStorage.setItem(STORAGE_KEY, JSON.stringify(data))
            } catch (e) {
                console.error('Failed to save to localStorage:', e)
            }
        }
    }

    // ============ Favorites ============

    /**
     * Check if a song is favorite
     */
    function isFavorite(songId: string): boolean {
        return favorites.value.includes(songId)
    }

    /**
     * Toggle favorite status
     */
    async function toggleFavorite(songId: string) {
        const idx = favorites.value.indexOf(songId)
        if (idx > -1) {
            favorites.value.splice(idx, 1)
        } else {
            favorites.value.unshift(songId)
        }
        await save()
    }

    /**
     * Add to favorites
     */
    async function addToFavorites(songId: string) {
        if (!favorites.value.includes(songId)) {
            favorites.value.unshift(songId)
            await save()
        }
    }

    /**
     * Remove from favorites
     */
    async function removeFromFavorites(songId: string) {
        const idx = favorites.value.indexOf(songId)
        if (idx > -1) {
            favorites.value.splice(idx, 1)
            await save()
        }
    }

    // ============ Recent Songs ============

    const MAX_RECENT = 50

    /**
     * Add to recent songs
     */
    async function addToRecent(songId: string) {
        // Remove if exists
        const idx = recentSongs.value.indexOf(songId)
        if (idx > -1) {
            recentSongs.value.splice(idx, 1)
        }
        
        // Add to front
        recentSongs.value.unshift(songId)
        
        // Limit size
        if (recentSongs.value.length > MAX_RECENT) {
            recentSongs.value = recentSongs.value.slice(0, MAX_RECENT)
        }
        
        await save()
    }

    /**
     * Clear recent songs
     */
    async function clearRecent() {
        recentSongs.value = []
        await save()
    }

    // ============ Playlists ============

    /**
     * Create a new playlist
     */
    async function createPlaylist(name: string, songIds: string[] = []): Promise<Playlist> {
        const playlist: Playlist = {
            id: crypto.randomUUID(),
            name,
            songIds,
            createdAt: Date.now(),
            updatedAt: Date.now()
        }
        
        playlists.value.push(playlist)
        await save()
        
        return playlist
    }

    /**
     * Delete a playlist
     */
    async function deletePlaylist(playlistId: string) {
        const idx = playlists.value.findIndex(p => p.id === playlistId)
        if (idx > -1) {
            playlists.value.splice(idx, 1)
            await save()
        }
    }

    /**
     * Update a playlist (name and/or songs)
     */
    async function updatePlaylist(playlistId: string, name: string, songIds: string[]) {
        const playlist = playlists.value.find(p => p.id === playlistId)
        if (playlist) {
            playlist.name = name
            playlist.songIds = songIds
            playlist.updatedAt = Date.now()
            await save()
        }
    }

    /**
     * Rename a playlist
     */
    async function renamePlaylist(playlistId: string, newName: string) {
        const playlist = playlists.value.find(p => p.id === playlistId)
        if (playlist) {
            playlist.name = newName
            playlist.updatedAt = Date.now()
            await save()
        }
    }

    /**
     * Add song to playlist
     */
    async function addToPlaylist(playlistId: string, songId: string) {
        const playlist = playlists.value.find(p => p.id === playlistId)
        if (playlist && !playlist.songIds.includes(songId)) {
            playlist.songIds.push(songId)
            playlist.updatedAt = Date.now()
            await save()
        }
    }

    /**
     * Remove song from playlist
     */
    async function removeFromPlaylist(playlistId: string, songId: string) {
        const playlist = playlists.value.find(p => p.id === playlistId)
        if (playlist) {
            const idx = playlist.songIds.indexOf(songId)
            if (idx > -1) {
                playlist.songIds.splice(idx, 1)
                playlist.updatedAt = Date.now()
                await save()
            }
        }
    }

    /**
     * Reorder songs in playlist
     */
    async function reorderPlaylist(playlistId: string, songIds: string[]) {
        const playlist = playlists.value.find(p => p.id === playlistId)
        if (playlist) {
            playlist.songIds = songIds
            playlist.updatedAt = Date.now()
            await save()
        }
    }

    /**
     * Get playlist by ID
     */
    function getPlaylist(playlistId: string): Playlist | undefined {
        return playlists.value.find(p => p.id === playlistId)
    }

    return {
        // State
        favorites: readonly(favorites),
        recentSongs: readonly(recentSongs),
        playlists: readonly(playlists),
        isInitialized: readonly(isInitialized),
        
        // Init
        init,
        
        // Favorites
        isFavorite,
        toggleFavorite,
        addToFavorites,
        removeFromFavorites,
        
        // Recent
        addToRecent,
        clearRecent,
        
        // Playlists
        createPlaylist,
        updatePlaylist,
        deletePlaylist,
        renamePlaylist,
        addToPlaylist,
        removeFromPlaylist,
        reorderPlaylist,
        getPlaylist
    }
}
