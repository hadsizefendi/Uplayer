import type { Song } from './useTauriFS'

const DB_NAME = 'uplayer_songs'
const DB_VERSION = 1
const STORE_NAME = 'songs'

// Extended Song type with raw data for fresh blob URL creation
export interface SongWithData extends Song {
    _fileData?: ArrayBuffer
    _fileType?: string
    _coverData?: ArrayBuffer
    _coverType?: string
}

// Track blob URLs for cleanup
const activeBlobUrls = new Map<string, { audio: string, cover?: string }>()

// Cache for convertFileSrc function
let convertFileSrc: ((path: string) => string) | null = null

async function getConvertFileSrc(): Promise<((path: string) => string) | null> {
    if (convertFileSrc) return convertFileSrc
    
    const isTauri = typeof window !== 'undefined' && '__TAURI__' in window
    if (!isTauri) return null
    
    try {
        const core = await import('@tauri-apps/api/core')
        convertFileSrc = core.convertFileSrc
        return convertFileSrc
    } catch {
        return null
    }
}

/**
 * IndexedDB based song storage for persistent audio files
 */
export function useSongStorage() {
    let db: IDBDatabase | null = null
    const isReady = ref(false)

    /**
     * Initialize IndexedDB
     */
    async function init(): Promise<void> {
        if (typeof window === 'undefined') return

        return new Promise((resolve, reject) => {
            const request = indexedDB.open(DB_NAME, DB_VERSION)

            request.onerror = () => {
                console.error('Failed to open IndexedDB:', request.error)
                reject(request.error)
            }

            request.onsuccess = () => {
                db = request.result
                isReady.value = true
                resolve()
            }

            request.onupgradeneeded = (event) => {
                const database = (event.target as IDBOpenDBRequest).result
                
                // Create songs store
                if (!database.objectStoreNames.contains(STORE_NAME)) {
                    const store = database.createObjectStore(STORE_NAME, { keyPath: 'id' })
                    store.createIndex('title', 'title', { unique: false })
                    store.createIndex('artist', 'artist', { unique: false })
                }
            }
        })
    }

    /**
     * Save a song with its audio file
     */
    async function saveSong(song: Song, file: File, coverBlob?: Blob | null): Promise<void> {
        if (!db) throw new Error('Database not initialized')

        // First read the file as ArrayBuffer (outside transaction)
        const arrayBuffer = await new Promise<ArrayBuffer>((resolve, reject) => {
            const reader = new FileReader()
            reader.onload = () => resolve(reader.result as ArrayBuffer)
            reader.onerror = () => reject(reader.error)
            reader.readAsArrayBuffer(file)
        })

        // Read cover as ArrayBuffer if provided
        let coverData: ArrayBuffer | null = null
        let coverType: string | null = null
        if (coverBlob) {
            coverData = await new Promise<ArrayBuffer>((resolve, reject) => {
                const reader = new FileReader()
                reader.onload = () => resolve(reader.result as ArrayBuffer)
                reader.onerror = () => reject(reader.error)
                reader.readAsArrayBuffer(coverBlob)
            })
            coverType = coverBlob.type
        }

        // Then save to IndexedDB with a fresh transaction
        return new Promise((resolve, reject) => {
            const transaction = db!.transaction([STORE_NAME], 'readwrite')
            const store = transaction.objectStore(STORE_NAME)

            const songData = {
                id: song.id,
                title: song.title,
                artist: song.artist,
                album: song.album,
                duration: song.duration,
                durationFormatted: song.durationFormatted,
                coverData: coverData,
                coverType: coverType,
                fileData: arrayBuffer,
                fileName: file.name,
                fileType: file.type,
                createdAt: Date.now()
            }

            const request = store.put(songData)
            request.onsuccess = () => resolve()
            request.onerror = () => reject(request.error)
        })
    }

    /**
     * Save a Tauri song (path-based, no file data)
     * For Tauri, we store the path and use convertFileSrc at playback time
     */
    async function saveTauriSong(song: Song): Promise<void> {
        if (!db) throw new Error('Database not initialized')

        return new Promise((resolve, reject) => {
            const transaction = db!.transaction([STORE_NAME], 'readwrite')
            const store = transaction.objectStore(STORE_NAME)

            const songData = {
                id: song.id,
                title: song.title,
                artist: song.artist,
                album: song.album,
                duration: song.duration,
                durationFormatted: song.durationFormatted,
                path: song.path, // Store original path for Tauri
                cover: song.cover,
                coverData: null,
                coverType: null,
                fileData: null, // No file data for Tauri songs
                fileName: null,
                fileType: null,
                isTauriSong: true, // Flag for Tauri songs
                createdAt: Date.now()
            }

            const request = store.put(songData)
            request.onsuccess = () => resolve()
            request.onerror = () => reject(request.error)
        })
    }

    /**
     * Create a fresh BLOB URL for a song
     * Each call creates a completely new blob from raw ArrayBuffer data
     * Returns both the URL and a cleanup function
     */
    function createFreshAudioUrl(song: SongWithData): string {
        // Create completely new Blob from raw ArrayBuffer
        if (song._fileData && song._fileType) {
            // Make a COPY of the ArrayBuffer to ensure uniqueness
            const dataCopy = song._fileData.slice(0)
            const blob = new Blob([dataCopy], { type: song._fileType })
            const url = URL.createObjectURL(blob)
            return url
        }
        
        // Fallback to existing path
        return song.path
    }
    
    /**
     * Revoke a blob URL to free memory and break any caching
     */
    function revokeBlobUrl(url: string): void {
        if (url && url.startsWith('blob:')) {
            try {
                URL.revokeObjectURL(url)
            } catch (e) {
                // Ignore errors
            }
        }
    }

    /**
     * Get a song by ID
     */
    async function getSong(id: string): Promise<SongWithData | null> {
        if (!db) return null

        const data = await new Promise<any>((resolve, reject) => {
            const transaction = db!.transaction([STORE_NAME], 'readonly')
            const store = transaction.objectStore(STORE_NAME)
            const request = store.get(id)

            request.onsuccess = () => resolve(request.result)
            request.onerror = () => reject(request.error)
        })

        if (!data) return null

        // Handle Tauri songs (path-based) - convert path using convertFileSrc
        if (data.isTauriSong) {
            const converter = await getConvertFileSrc()
            const audioPath = converter ? converter(data.path) : data.path
            // Cover is already a data URL (base64) from Tauri, no conversion needed
            const coverPath = data.cover

            return {
                id: data.id,
                title: data.title,
                artist: data.artist,
                album: data.album,
                duration: data.duration,
                durationFormatted: data.durationFormatted,
                path: audioPath,
                cover: coverPath
            }
        }

        // Handle web songs (blob-based) - check if fileData exists
        if (!data.fileData) {
            console.warn('Song missing fileData:', data.id)
            return null
        }

        const blob = new Blob([data.fileData], { type: data.fileType || 'audio/mpeg' })
        const url = URL.createObjectURL(blob)

        // Create cover URL if available
        let coverUrl: string | null = null
        if (data.coverData && data.coverType) {
            const coverBlob = new Blob([data.coverData], { type: data.coverType })
            coverUrl = URL.createObjectURL(coverBlob)
        }

        // Track URLs
        activeBlobUrls.set(data.id, { audio: url, cover: coverUrl || undefined })

        return {
            id: data.id,
            title: data.title,
            artist: data.artist,
            album: data.album,
            duration: data.duration,
            durationFormatted: data.durationFormatted,
            path: url,
            cover: coverUrl,
            // Store raw data for fresh URL creation
            _fileData: data.fileData,
            _fileType: data.fileType,
            _coverData: data.coverData,
            _coverType: data.coverType
        }
    }

    /**
     * Get all songs
     */
    async function getAllSongs(): Promise<SongWithData[]> {
        if (!db) return []

        const allData = await new Promise<any[]>((resolve, reject) => {
            const transaction = db!.transaction([STORE_NAME], 'readonly')
            const store = transaction.objectStore(STORE_NAME)
            const request = store.getAll()

            request.onsuccess = () => resolve(request.result)
            request.onerror = () => reject(request.error)
        })

        const songs: SongWithData[] = []
        const converter = await getConvertFileSrc()
        
        for (const data of allData) {
            try {
                // Handle Tauri songs (path-based)
                if (data.isTauriSong) {
                    const audioPath = converter ? converter(data.path) : data.path
                    // Cover is already a data URL (base64) from Tauri
                    const coverPath = data.cover

                    songs.push({
                        id: data.id,
                        title: data.title,
                        artist: data.artist,
                        album: data.album,
                        duration: data.duration,
                        durationFormatted: data.durationFormatted,
                        path: audioPath,
                        cover: coverPath
                    } as SongWithData)
                    continue
                }

                // Handle web songs (blob-based) - check if fileData exists
                if (!data.fileData) {
                    console.warn('Song missing fileData:', data.id)
                    continue
                }

                const blob = new Blob([data.fileData], { type: data.fileType || 'audio/mpeg' })
                const url = URL.createObjectURL(blob)

                // Create cover URL if available
                let coverUrl: string | null = null
                if (data.coverData && data.coverType) {
                    const coverBlob = new Blob([data.coverData], { type: data.coverType })
                    coverUrl = URL.createObjectURL(coverBlob)
                }

                // Track URLs
                activeBlobUrls.set(data.id, { audio: url, cover: coverUrl || undefined })

                songs.push({
                    id: data.id,
                    title: data.title,
                    artist: data.artist,
                    album: data.album,
                    duration: data.duration,
                    durationFormatted: data.durationFormatted,
                    path: url,
                    cover: coverUrl,
                    // Store raw data for fresh URL creation
                    _fileData: data.fileData,
                    _fileType: data.fileType,
                    _coverData: data.coverData,
                    _coverType: data.coverType
                } as SongWithData)
            } catch (e) {
                console.error('Failed to process song:', data.id, e)
            }
        }
        
        return songs
    }

    /**
     * Get songs by IDs
     */
    async function getSongsByIds(ids: string[]): Promise<SongWithData[]> {
        if (!db || !ids.length) return []

        const songs: SongWithData[] = []
        for (const id of ids) {
            try {
                const song = await getSong(id)
                if (song) {
                    songs.push(song)
                } else {
                    console.warn(`Song not found in IndexedDB: ${id}`)
                }
            } catch (e) {
                console.error(`Failed to get song ${id}:`, e)
            }
        }
        return songs
    }

    /**
     * Delete a song
     */
    async function deleteSong(id: string): Promise<void> {
        if (!db) return

        // Revoke blob URLs
        const urls = activeBlobUrls.get(id)
        if (urls) {
            if (urls.audio) try { URL.revokeObjectURL(urls.audio) } catch {}
            if (urls.cover) try { URL.revokeObjectURL(urls.cover) } catch {}
            activeBlobUrls.delete(id)
        }

        return new Promise((resolve, reject) => {
            const transaction = db!.transaction([STORE_NAME], 'readwrite')
            const store = transaction.objectStore(STORE_NAME)
            const request = store.delete(id)

            request.onsuccess = () => resolve()
            request.onerror = () => reject(request.error)
        })
    }

    /**
     * Clear all songs
     */
    async function clearAll(): Promise<void> {
        if (!db) return

        // Revoke all blob URLs
        for (const [, urls] of activeBlobUrls) {
            if (urls.audio) try { URL.revokeObjectURL(urls.audio) } catch {}
            if (urls.cover) try { URL.revokeObjectURL(urls.cover) } catch {}
        }
        activeBlobUrls.clear()

        return new Promise((resolve, reject) => {
            const transaction = db!.transaction([STORE_NAME], 'readwrite')
            const store = transaction.objectStore(STORE_NAME)
            const request = store.clear()

            request.onsuccess = () => resolve()
            request.onerror = () => reject(request.error)
        })
    }

    /**
     * Get storage info
     */
    async function getStorageInfo(): Promise<{ count: number; size: number }> {
        if (!db) return { count: 0, size: 0 }

        return new Promise((resolve, reject) => {
            const transaction = db!.transaction([STORE_NAME], 'readonly')
            const store = transaction.objectStore(STORE_NAME)
            const countRequest = store.count()

            countRequest.onsuccess = async () => {
                // Estimate size
                try {
                    const estimate = await navigator.storage?.estimate?.()
                    resolve({
                        count: countRequest.result,
                        size: estimate?.usage || 0
                    })
                } catch {
                    resolve({ count: countRequest.result, size: 0 })
                }
            }
            countRequest.onerror = () => reject(countRequest.error)
        })
    }

    return {
        isReady: readonly(isReady),
        init,
        saveSong,
        saveTauriSong,
        getSong,
        getAllSongs,
        getSongsByIds,
        deleteSong,
        clearAll,
        getStorageInfo,
        createFreshAudioUrl,
        revokeBlobUrl
    }
}
