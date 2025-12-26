export interface Song {
    id: string
    title: string
    artist: string
    album: string
    duration: number
    durationFormatted: string
    path: string
    cover: string | null
}

export interface ScanResult {
    songs: Song[]
    errors: string[]
}

// Drag-drop event callback type
export type DragDropCallback = (paths: string[]) => void

/**
 * Tauri File System - Local music file access
 * With browser fallback for development
 */
export function useTauriFS() {
    const songs = ref<Song[]>([])
    const isScanning = ref(false)
    const scanProgress = ref('')
    const errors = ref<string[]>([])
    const isDraggingOver = ref(false)

    // Check if running in Tauri
    const isTauri = computed(() => typeof window !== 'undefined' && '__TAURI__' in window)

    // Dynamic imports for Tauri APIs - using any to avoid type issues before pnpm install
    let invoke: any = null
    let open: any = null
    let convertFileSrc: any = null
    let getCurrentWindow: any = null
    let readFile: any = null
    let unlisten: (() => void) | null = null

    async function loadTauriAPIs() {
        if (!isTauri.value) return false
        
        try {
            const core = await import('@tauri-apps/api/core')
            const dialog = await import('@tauri-apps/plugin-dialog')
            const tauriWindow = await import('@tauri-apps/api/window')
            const fs = await import('@tauri-apps/plugin-fs')
            invoke = core.invoke
            convertFileSrc = core.convertFileSrc
            open = dialog.open
            getCurrentWindow = tauriWindow.getCurrentWindow
            readFile = fs.readFile
            return true
        } catch (e) {
            console.warn('Failed to load Tauri APIs:', e)
            return false
        }
    }

    /**
     * Setup Tauri drag-drop listener
     * Returns cleanup function
     */
    async function setupDragDropListener(onDrop: DragDropCallback): Promise<() => void> {
        if (!isTauri.value) return () => {}
        
        try {
            await loadTauriAPIs()
            if (!getCurrentWindow) return () => {}

            const win = getCurrentWindow()
            
            // Listen to drag-drop events
            unlisten = await win.onDragDropEvent((event: any) => {
                if (event.payload.type === 'over') {
                    isDraggingOver.value = true
                } else if (event.payload.type === 'leave' || event.payload.type === 'cancel') {
                    isDraggingOver.value = false
                } else if (event.payload.type === 'drop') {
                    isDraggingOver.value = false
                    const paths = event.payload.paths as string[]
                    if (paths && paths.length > 0) {
                        onDrop(paths)
                    }
                }
            })

            return () => {
                if (unlisten) {
                    unlisten()
                    unlisten = null
                }
            }
        } catch (e) {
            console.error('Failed to setup drag-drop listener:', e)
            return () => {}
        }
    }

    /**
     * Format duration from seconds to mm:ss
     */
    function formatDuration(seconds: number): string {
        const mins = Math.floor(seconds / 60)
        const secs = Math.floor(seconds % 60)
        return `${mins}:${secs.toString().padStart(2, '0')}`
    }

    /**
     * Open folder picker and scan for music files
     */
    async function openFolder(): Promise<Song[]> {
        if (!await loadTauriAPIs() || !open || !invoke) {
            console.warn('Tauri APIs not available')
            return []
        }

        try {
            const selected = await open({
                directory: true,
                multiple: false,
                title: 'Select Music Folder'
            })

            if (selected) {
                return await scanFolder(selected as string)
            }
        } catch (error) {
            console.error('Failed to open folder:', error)
            errors.value.push(`Failed to open folder: ${error}`)
        }

        return []
    }

    /**
     * Open file picker for multiple audio files
     */
    async function openFiles(): Promise<Song[]> {
        if (!await loadTauriAPIs() || !open || !invoke) {
            console.warn('Tauri APIs not available')
            return []
        }

        try {
            const selected = await open({
                multiple: true,
                title: 'Select Audio Files',
                filters: [{
                    name: 'Audio Files',
                    extensions: ['mp3', 'wav', 'flac', 'ogg', 'm4a', 'aac', 'opus']
                }]
            })

            if (selected && Array.isArray(selected)) {
                return await scanFiles(selected)
            }
        } catch (error) {
            console.error('Failed to open files:', error)
            errors.value.push(`Failed to open files: ${error}`)
        }

        return []
    }

    /**
     * Scan a folder for music files
     */
    async function scanFolder(path: string): Promise<Song[]> {
        if (!invoke) return []

        isScanning.value = true
        scanProgress.value = 'Scanning folder...'

        try {
            const result = await invoke('scan_music_folder', { path }) as ScanResult
            
            // Load cover art for each song
            const songsWithCovers = await Promise.all(
                result.songs.map(async (song: Song) => {
                    const cover = await getCoverArt(song.path)
                    return { 
                        ...song, 
                        cover,
                        durationFormatted: formatDuration(song.duration)
                    }
                })
            )

            songs.value = [...songs.value, ...songsWithCovers]
            errors.value = [...errors.value, ...result.errors]
            
            return songsWithCovers
        } catch (error) {
            console.error('Failed to scan folder:', error)
            errors.value.push(`Scan failed: ${error}`)
            return []
        } finally {
            isScanning.value = false
            scanProgress.value = ''
        }
    }

    /**
     * Scan multiple files
     */
    async function scanFiles(paths: string[]): Promise<Song[]> {
        if (!invoke) return []

        isScanning.value = true
        scanProgress.value = 'Processing files...'

        try {
            const result = await invoke('scan_music_files', { paths }) as ScanResult
            
            // Load cover art for each song
            const songsWithCovers = await Promise.all(
                result.songs.map(async (song: Song) => {
                    const cover = await getCoverArt(song.path)
                    return { 
                        ...song, 
                        cover,
                        durationFormatted: formatDuration(song.duration)
                    }
                })
            )

            songs.value = [...songs.value, ...songsWithCovers]
            errors.value = [...errors.value, ...result.errors]
            
            return songsWithCovers
        } catch (error) {
            console.error('Failed to scan files:', error)
            errors.value.push(`Scan failed: ${error}`)
            return []
        } finally {
            isScanning.value = false
            scanProgress.value = ''
        }
    }

    /**
     * Get cover art for a song (base64 data URL)
     */
    async function getCoverArt(path: string): Promise<string | null> {
        if (!invoke) return null

        try {
            const cover = await invoke('get_cover_art', { path }) as string | null
            return cover
        } catch (error) {
            console.debug('No cover art found:', error)
            return null
        }
    }

    /**
     * Convert file path to playable URL (Tauri asset protocol)
     * Manual URL construction to avoid double-encoding issues
     */
    function getAudioUrl(path: string): string {
        if (!path) return ''
        
        // For Tauri v2, construct the asset URL manually
        // encodeURI encodes special chars but NOT path separators
        const encodedPath = encodeURI(path)
        return `asset://localhost${encodedPath}`
    }
    
    /**
     * Read audio file and create a blob URL
     * This bypasses asset protocol issues entirely
     */
    async function getAudioBlobUrl(path: string): Promise<string> {
        if (!path) return ''
        
        await loadTauriAPIs()
        
        if (!readFile) {
            console.warn('Tauri fs plugin not available, falling back to asset protocol')
            return getAudioUrl(path)
        }
        
        try {
            const data = await readFile(path)
            
            // CRITICAL: Uint8Array.buffer might have a different byteLength than the Uint8Array itself
            // if the Uint8Array is a view into a larger buffer. We need to copy the exact data.
            let blobData: ArrayBuffer
            if (data.byteOffset !== 0 || data.buffer.byteLength !== data.byteLength) {
                blobData = data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength)
            } else {
                blobData = data.buffer
            }
            
            // Determine MIME type from extension
            const ext = path.split('.').pop()?.toLowerCase() || 'mp3'
            const mimeTypes: Record<string, string> = {
                'mp3': 'audio/mpeg',
                'wav': 'audio/wav',
                'flac': 'audio/flac',
                'ogg': 'audio/ogg',
                'oga': 'audio/ogg',
                'm4a': 'audio/mp4',
                'aac': 'audio/aac',
                'opus': 'audio/opus',
                'webm': 'audio/webm'
            }
            const mimeType = mimeTypes[ext] || 'audio/mpeg'
            
            // Create blob URL with the correct data
            const blob = new Blob([blobData], { type: mimeType })
            const url = URL.createObjectURL(blob)
            return url
        } catch (e) {
            console.error('Failed to read file:', e)
            // Fallback to asset protocol
            return getAudioUrl(path)
        }
    }
    
    /**
     * Read audio file as ArrayBuffer for Web Audio API
     * This completely bypasses HTMLAudioElement and its caching issues
     */
    async function getAudioArrayBuffer(path: string): Promise<ArrayBuffer | null> {
        if (!path) return null
        
        await loadTauriAPIs()
        
        if (!readFile) {
            console.warn('Tauri fs plugin not available')
            return null
        }
        
        try {
            const data = await readFile(path)
            return data.buffer
        } catch (e) {
            console.error('Failed to read file as ArrayBuffer:', e)
            return null
        }
    }

    /**
     * Clear all songs
     */
    function clearSongs() {
        songs.value = []
        errors.value = []
    }

    /**
     * Remove a song from the list
     */
    function removeSong(id: string) {
        songs.value = songs.value.filter(s => s.id !== id)
    }

    /**
     * Add songs from command line arguments (file associations)
     */
    async function handleFileOpen(paths: string[]): Promise<Song[]> {
        if (!paths.length) return []
        await loadTauriAPIs()
        return await scanFiles(paths)
    }

    return {
        songs: readonly(songs),
        isScanning: readonly(isScanning),
        scanProgress: readonly(scanProgress),
        errors: readonly(errors),
        isTauri,
        isDraggingOver,
        openFolder,
        openFiles,
        scanFolder,
        scanFiles,
        getCoverArt,
        getAudioUrl,
        getAudioBlobUrl,
        getAudioArrayBuffer,
        clearSongs,
        removeSong,
        handleFileOpen,
        setupDragDropListener
    }
}
