<template>
    <div 
        class="min-h-screen overflow-hidden flex flex-col relative rounded-md"
        @dragover.prevent="onDragOver"
        @dragleave.prevent="onDragLeave"
        @drop.prevent="onDrop"
    >
        <!-- Window Titlebar (Tauri only) -->
        <WindowTitlebar />

        <!-- Drop Zone Overlay -->
        <Transition name="fade">
            <div v-if="showDragOverlay" class="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center pointer-events-none">
                <div class="border-4 border-dashed border-primary rounded-3xl p-12 text-center">
                    <UIcon name="i-heroicons-musical-note" class="text-6xl text-primary mb-4" />
                    <p class="text-2xl font-bold text-white">Drop your music here</p>
                    <p class="text-white/60 mt-2">Files or folders supported</p>
                </div>
            </div>
        </Transition>

        <!-- Settings Slideover -->
        <USlideover v-model:open="settingsOpen" title="Settings" description="Configure your player settings" side="right" :ui="{ content: 'bg-black/95 backdrop-blur-xl z-10', body: 'p-0', close: 'right-4 top-10 left-auto' }">
            <UButton @click="settingsOpen = true" variant="link"
                class="fixed z-1 bottom-1 left-1 size-10 flex items-center justify-center transition-all">
                <UIcon name="i-heroicons-cog-6-tooth" class="text-white text-lg animate-spin-slow" style="animation-duration: 8s;" />
            </UButton>
            <template #body>
                <SettingsContent :settings="settings" :volume="volume"
                    @toggle="toggleSetting" @update:volume="setVolume" @waveTypeChange="onWaveTypeChange" />
            </template>
            <template #footer>
                <div class="w-full text-center space-y-1">
                    <p class="text-gray-500 text-xs">Uplayer • Music Player</p>
                    <p class="text-gray-600 text-[10px]">v{{ appVersion }}</p>
                </div>
            </template>
        </USlideover>

        <!-- Dynamic Background -->
        <div class="fixed inset-0 transition-opacity duration-1000">
            <img :src="currentSong?.cover || '/default.webp'" :alt="currentSong?.title || 'Uplayer'"
                class="w-full h-full object-cover blur-3xl scale-110" />
            <div class="absolute inset-0 bg-black/70"></div>
        </div>

        <!-- Audio Element - Created programmatically to avoid WebKitGTK caching -->
        <div ref="audioContainer" class="hidden"></div>

        <!-- Wave Visualizer -->
        <AudioWaveVisualizer ref="waveVisualizerRef" class="pt-6"
            :playlistExpanded="playlistExpanded" :waveEnabled="settings.waveEnabled" :waveType="settings.waveType"
            :isPlaying="isPlaying" :coverContainerRef="coverDisplayRef?.coverContainerRef" />

        <!-- Main Player Container -->
        <div class="fixed bottom-0 left-0 right-0">
            <div class="flex flex-col">
                <div :class="['flex flex-col items-center transition-all duration-300 ease-out shrink-0', playlistExpanded ? 'pt-2 pb-1' : 'pt-4 pb-2']">
                    <!-- Cover Display Component -->
                    <CoverDisplay ref="coverDisplayRef" :currentSong="displaySong" :audioIntensity="audioIntensity"
                        :compact="playlistExpanded"
                        :previousSong="previousSong" :nextSong="nextSong" :hasSongs="songs.length > 0"
                        @swipeNext="playNext" @swipePrevious="playPrevious" @filesSelected="handleFilesSelected" @browseFiles="handleTauriFilesDialog" />
                    
                    <!-- Player Controls Component -->
                    <PlayerControls :currentSong="currentSong" :isPlaying="isPlaying" :currentTime="currentTime"
                        :duration="duration" :isShuffled="isShuffled" :repeatMode="repeatMode" :isNextAnimating="isNextAnimating"
                        :isPrevAnimating="isPrevAnimating" :compact="playlistExpanded" @togglePlay="togglePlay"
                        @playNext="playNext" @playPrevious="playPrevious" @toggleShuffle="toggleShuffle"
                        @toggleRepeat="toggleRepeat" @seek="seek" />
                </div>

                <!-- Playlist Drawer Component -->
                <PlaylistDrawer 
                    :songs="displaySongs" 
                    :currentSong="currentSong" 
                    :isPlaying="isPlaying" 
                    :expanded="playlistExpanded"
                    :playlists="musicLibrary.playlists.value"
                    :currentPlaylistId="currentPlaylistId"
                    :favoriteIds="musicLibrary.favorites.value"
                    :totalSongCount="totalSongCount"
                    :allAvailableSongs="allSongs"
                    :nowPlayingSongs="nowPlayingSongs"
                    @toggle="playlistExpanded = !playlistExpanded" 
                    @selectSong="handleSongSelect" 
                    @addFiles="handleFilesFromInput"
                    @addTauriFiles="handleTauriFilesDialog"
                    @createPlaylist="handleCreatePlaylist"
                    @editPlaylist="handleEditPlaylist"
                    @selectPlaylist="handleSelectPlaylist"
                    @deletePlaylist="handleDeletePlaylist"
                    @toggleFavorite="handleToggleFavorite"
                    @addToPlaylists="handleAddToPlaylists"
                    @deleteSong="handleDeleteSong"
                    @reorderSongs="handleReorderSongs"
                />
            </div>
        </div>
    </div>
</template>

<script setup lang="ts">
import type { Song } from '~/composables/useTauriFS'
import type { SongWithData } from '~/composables/useSongStorage'

// Composables
const webAudioPlayer = useWebAudioPlayer()
const mediaSession = useMediaSession()
const playerSettings = usePlayerSettings()
const tauriFS = useTauriFS()
const musicLibrary = useMusicLibrary()
const songStorage = useSongStorage()

// Songs from Tauri FS
const songs = ref<SongWithData[]>([])
const allSongs = ref<SongWithData[]>([]) // All songs from storage
const isLoadingSongs = ref(false)

// Refs - No more HTMLAudioElement!
const currentSong = ref<Song | null>(null)
const isPlaying = ref(false)
const currentTime = ref(0)
const duration = ref(0)
const playlistExpanded = ref(false)
const volume = ref(100)
const isMuted = ref(false)
const previousVolume = ref(100)
const isShuffled = ref(false)
const repeatMode = ref<'off' | 'all' | 'one'>('all')
const isNextAnimating = ref(false)
const isPrevAnimating = ref(false)
const settingsOpen = ref(false)

// Component refs
const coverDisplayRef = ref<any>(null)
const waveVisualizerRef = ref<any>(null)

// Drag & Drop state
const isDragging = ref(false)
let dragCounter = 0

// Combined drag state (HTML5 or Tauri)
const showDragOverlay = computed(() => isDragging.value || tauriFS.isDraggingOver.value)

// Playlist management
const currentPlaylistId = ref<string | null>(null)
const nowPlayingSongs = ref<Song[]>([]) // Temp playlist for externally opened files

// Settings
const settings = reactive({
    soundEnabled: true,
    waveEnabled: true,
    waveType: 'uniquewave' as 'equalizer' | 'uniquewave'
})

const appVersion = '2.0.0'

// Computed - audioIntensity from Web Audio Player
const audioIntensity = ref(0)
const { STORAGE_KEYS } = playerSettings

// Display song with default cover fallback
const displaySong = computed(() => {
    if (!currentSong.value) return null
    return {
        ...currentSong.value,
        cover: currentSong.value.cover || '/default.webp'
    }
})

// Display songs with default cover fallback
const displaySongs = computed(() => {
    return songs.value.map(song => ({
        ...song,
        cover: song.cover || '/default.webp'
    }))
})

// Previous and next songs for preloading covers
const currentSongIndex = computed(() => {
    if (!songs.value.length || !currentSong.value) return -1
    return songs.value.findIndex(s => s.id === currentSong.value?.id)
})

const previousSong = computed(() => {
    if (!songs.value.length || currentSongIndex.value < 0) return null
    const idx = currentSongIndex.value === 0 ? songs.value.length - 1 : currentSongIndex.value - 1
    const song = songs.value[idx]
    return song ? { ...song, cover: song.cover || '/default.webp' } : null
})

const nextSong = computed(() => {
    if (!songs.value.length || currentSongIndex.value < 0) return null
    const idx = (currentSongIndex.value + 1) % songs.value.length
    const song = songs.value[idx]
    return song ? { ...song, cover: song.cover || '/default.webp' } : null
})

// Total song count (always from allSongs)
const totalSongCount = computed(() => allSongs.value.length)

// Handle file selection from UFileUpload @update:model-value event
function handleFilesSelected(value: File | File[] | null | undefined) {
    if (!value) return
    
    // TAURI MODE: Web file input doesn't give full paths, use Tauri dialog instead
    if (tauriFS.isTauri.value) {
        handleTauriFilesDialog()
        return
    }
    
    const files = Array.isArray(value) ? value : [value]
    processAudioFiles(files)
}

// Handle files from native input (PlaylistDrawer)
function handleFilesFromInput(files: File[]) {
    // TAURI MODE: Web file input doesn't give full paths, use Tauri dialog instead
    if (tauriFS.isTauri.value) {
        handleTauriFilesDialog()
        return
    }
    
    processAudioFiles(files)
}

// Handle Tauri file dialog - opens native file picker and gets full paths
async function handleTauriFilesDialog() {
    const newSongs = await tauriFS.openFiles()
    if (newSongs.length) {
        // Save to IndexedDB (metadata only, no blob)
        for (const song of newSongs) {
            try {
                await songStorage.saveTauriSong(song)
            } catch (e) {
                console.warn('Failed to save Tauri song:', e)
            }
        }
        addSongsToPlaylist(newSongs)
    }
}

// Process audio files and add to playlist (WEB MODE ONLY)
async function processAudioFiles(files: File[]) {
    if (!files.length) return

    // WEB MODE: Normal blob storage (tarayıcıda sorunsuz çalışır)
    // Dynamically import music-metadata-browser
    const { parseBlob } = await import('music-metadata-browser')

    const newSongs: Song[] = []
    
    // Process files with duration and metadata extraction
    for (let index = 0; index < files.length; index++) {
        const file = files[index]!
        if (file.type.startsWith('audio/') || /\.(mp3|wav|flac|ogg|m4a|aac|opus)$/i.test(file.name)) {
            const url = URL.createObjectURL(file)
            
            // Extract metadata from audio file
            let title = file.name.replace(/\.[^/.]+$/, '')
            let artist = 'Unknown Artist'
            let album = 'Unknown Album'
            let duration = 0
            let coverUrl: string | null = null
            let coverBlob: Blob | null = null
            
            try {
                const metadata = await parseBlob(file)
                
                // Get title, artist, album from tags
                if (metadata.common.title) title = metadata.common.title
                if (metadata.common.artist) artist = metadata.common.artist
                if (metadata.common.album) album = metadata.common.album
                
                // Get duration
                if (metadata.format.duration) duration = metadata.format.duration
                
                // Extract cover art
                if (metadata.common.picture && metadata.common.picture.length > 0) {
                    const picture = metadata.common.picture[0]!
                    coverBlob = new Blob([picture.data], { type: picture.format })
                    coverUrl = URL.createObjectURL(coverBlob)
                }
            } catch (e) {
                console.warn('Failed to parse metadata:', e)
                // Fallback to basic duration detection
                duration = await getAudioDuration(url)
            }
            
            // If duration wasn't in metadata, get it from audio element
            if (!duration) {
                duration = await getAudioDuration(url)
            }
            
            const song: Song = {
                id: `file-${Date.now()}-${index}`,
                title,
                artist,
                album,
                duration,
                durationFormatted: formatDuration(duration),
                path: url,
                cover: coverUrl
            }
            
            newSongs.push(song)
            
            // Save to IndexedDB for persistence (with cover blob)
            try {
                await songStorage.saveSong(song, file, coverBlob)
            } catch (e) {
                console.warn('Failed to save song to storage:', e)
            }
        }
    }

    if (newSongs.length) {
        addSongsToPlaylist(newSongs)
    }
}

// Get audio duration from URL
function getAudioDuration(url: string): Promise<number> {
    return new Promise((resolve) => {
        const audio = new Audio()
        audio.addEventListener('loadedmetadata', () => {
            resolve(audio.duration || 0)
        })
        audio.addEventListener('error', () => {
            resolve(0)
        })
        audio.src = url
    })
}

// Format duration in mm:ss
function formatDuration(seconds: number): string {
    if (!seconds || !isFinite(seconds)) return '0:00'
    const mins = Math.floor(seconds / 60)
    const secs = Math.floor(seconds % 60)
    return `${mins}:${secs.toString().padStart(2, '0')}`
}

// Drag & Drop handlers
function onDragOver(e: DragEvent) {
    dragCounter++
    if (e.dataTransfer?.types.includes('Files')) {
        isDragging.value = true
    }
}

function onDragLeave() {
    dragCounter--
    if (dragCounter <= 0) {
        dragCounter = 0
        isDragging.value = false
    }
}

async function onDrop(e: DragEvent) {
    isDragging.value = false
    dragCounter = 0
    
    const items = e.dataTransfer?.items
    if (!items) return

    const files: File[] = []
    
    // Process all items (files and folders)
    const promises: Promise<void>[] = []
    
    for (const item of items) {
        const entry = item.webkitGetAsEntry?.()
        if (entry) {
            promises.push(traverseFileTree(entry, files))
        } else if (item.kind === 'file') {
            const file = item.getAsFile()
            if (file) files.push(file)
        }
    }
    
    await Promise.all(promises)
    
    if (files.length) {
        processAudioFiles(files)
    }
}

// Recursively traverse folder structure
async function traverseFileTree(entry: FileSystemEntry, files: File[]): Promise<void> {
    if (entry.isFile) {
        const fileEntry = entry as FileSystemFileEntry
        return new Promise((resolve) => {
            fileEntry.file((file) => {
                if (file.type.startsWith('audio/') || /\.(mp3|wav|flac|ogg|m4a|aac|opus)$/i.test(file.name)) {
                    files.push(file)
                }
                resolve()
            }, () => resolve())
        })
    } else if (entry.isDirectory) {
        const dirEntry = entry as FileSystemDirectoryEntry
        const reader = dirEntry.createReader()
        
        return new Promise((resolve) => {
            const readEntries = () => {
                reader.readEntries(async (entries) => {
                    if (entries.length === 0) {
                        resolve()
                        return
                    }
                    
                    await Promise.all(entries.map(e => traverseFileTree(e, files)))
                    readEntries() // Continue reading (some browsers batch results)
                }, () => resolve())
            }
            readEntries()
        })
    }
}

// Add songs to playlist helper
function addSongsToPlaylist(newSongs: Song[]) {
    // Filter out duplicates (by id or path)
    const existingIds = new Set(allSongs.value.map(s => s.id))
    const existingPaths = new Set(allSongs.value.map(s => s.path).filter(Boolean))
    
    const uniqueNewSongs = newSongs.filter(song => {
        // Check by ID
        if (existingIds.has(song.id)) return false
        // Check by path (for Tauri songs)
        if (song.path && existingPaths.has(song.path)) return false
        return true
    })
    
    if (uniqueNewSongs.length === 0) return
    
    // Always add to allSongs
    allSongs.value = [...allSongs.value, ...uniqueNewSongs]
    
    // Add to current view if showing all songs or no playlist selected
    if (currentPlaylistId.value === null) {
        songs.value = [...allSongs.value]
    } else if (currentPlaylistId.value && currentPlaylistId.value !== 'favorites') {
        // If viewing a specific playlist, add songs to it
        songs.value = [...songs.value, ...uniqueNewSongs]
        uniqueNewSongs.forEach(song => {
            musicLibrary.addToPlaylist(currentPlaylistId.value!, song.id)
        })
    }
    
    if (!currentSong.value && uniqueNewSongs[0]) {
        selectSong(uniqueNewSongs[0])
    }
}

// Playlist handlers
async function handleCreatePlaylist(name: string, songIds: string[]) {
    const playlist = await musicLibrary.createPlaylist(name, songIds)
    currentPlaylistId.value = playlist.id
}

async function handleEditPlaylist(playlistId: string, name: string, songIds: string[]) {
    await musicLibrary.updatePlaylist(playlistId, name, songIds)
    // Refresh current playlist view if we're viewing the edited playlist
    if (currentPlaylistId.value === playlistId) {
        await handleSelectPlaylist(playlistId)
    }
}

async function handleSelectPlaylist(playlistId: string | null) {
    currentPlaylistId.value = playlistId
    
    if (playlistId === null) {
        // Load all songs
        songs.value = [...allSongs.value]
    } else if (playlistId === 'favorites') {
        // Load favorite songs
        isLoadingSongs.value = true
        try {
            const favoriteSongs = await songStorage.getSongsByIds([...musicLibrary.favorites.value])
            songs.value = favoriteSongs
        } catch (e) {
            console.error('Failed to load favorite songs:', e)
        } finally {
            isLoadingSongs.value = false
        }
    } else if (playlistId === '__now_playing__') {
        // Load Now Playing temp playlist
        songs.value = [...nowPlayingSongs.value]
    } else {
        // Load only songs in this playlist
        const playlist = musicLibrary.playlists.value.find(p => p.id === playlistId)
        if (playlist) {
            isLoadingSongs.value = true
            try {
                const playlistSongs = await songStorage.getSongsByIds([...playlist.songIds])
                songs.value = playlistSongs
                
                // If current song is not in this playlist, select first song
                if (currentSong.value && !playlist.songIds.includes(currentSong.value.id)) {
                    if (playlistSongs.length > 0 && playlistSongs[0]) {
                        selectSong(playlistSongs[0], false)
                    } else {
                        currentSong.value = null
                    }
                }
            } catch (e) {
                console.error('Failed to load playlist songs:', e)
            } finally {
                isLoadingSongs.value = false
            }
        }
    }
}

async function handleDeletePlaylist(playlistId: string) {
    await musicLibrary.deletePlaylist(playlistId)
    if (currentPlaylistId.value === playlistId) {
        currentPlaylistId.value = null
        songs.value = [...allSongs.value]
    }
}

// Toggle favorite for a song
async function handleToggleFavorite(songId: string) {
    await musicLibrary.toggleFavorite(songId)
    
    // If viewing favorites, update the list
    if (currentPlaylistId.value === 'favorites') {
        const favoriteSongs = await songStorage.getSongsByIds([...musicLibrary.favorites.value])
        songs.value = favoriteSongs
    }
}

// Add song to multiple playlists
async function handleAddToPlaylists(songId: string, playlistIds: string[]) {
    for (const playlistId of playlistIds) {
        await musicLibrary.addToPlaylist(playlistId, songId)
    }
}

// Delete a song from library
async function handleDeleteSong(songId: string) {
    // Remove from IndexedDB
    await songStorage.deleteSong(songId)
    
    // Remove from allSongs
    allSongs.value = allSongs.value.filter(s => s.id !== songId)
    
    // Remove from current view
    songs.value = songs.value.filter(s => s.id !== songId)
    
    // Remove from favorites if present
    if (musicLibrary.isFavorite(songId)) {
        await musicLibrary.removeFromFavorites(songId)
    }
    
    // If current song was deleted, clear it or play next
    if (currentSong.value?.id === songId) {
        if (songs.value.length > 0) {
            selectSong(songs.value[0]!, false)
        } else {
            currentSong.value = null
            isPlaying.value = false
        }
    }
}

// Reorder songs in the playlist
function handleReorderSongs(fromIndex: number, toIndex: number) {
    // Make a copy of the songs array
    const reorderedSongs = [...songs.value]
    
    // Remove the item from its original position
    const [movedSong] = reorderedSongs.splice(fromIndex, 1)
    
    if (movedSong) {
        // Insert it at the new position
        reorderedSongs.splice(toIndex, 0, movedSong)
        
        // Update the songs array
        songs.value = reorderedSongs
        
        // If viewing all songs, also update allSongs
        if (currentPlaylistId.value === null) {
            allSongs.value = reorderedSongs
            // Save the order to storage
            saveSongOrder(reorderedSongs.map(s => s.id))
        } else if (currentPlaylistId.value && currentPlaylistId.value !== 'favorites') {
            // Update playlist song order
            musicLibrary.reorderPlaylist(currentPlaylistId.value, reorderedSongs.map(s => s.id))
        }
    }
}

// Save song order to localStorage
function saveSongOrder(songIds: string[]) {
    try {
        localStorage.setItem('uplayer_song_order', JSON.stringify(songIds))
    } catch (e) {
        console.warn('Failed to save song order:', e)
    }
}

// Load song order from localStorage
function loadSongOrder(): string[] | null {
    try {
        const order = localStorage.getItem('uplayer_song_order')
        return order ? JSON.parse(order) : null
    } catch (e) {
        return null
    }
}

// Load all songs from IndexedDB
async function loadAllSongs() {
    isLoadingSongs.value = true
    try {
        const storedSongs = await songStorage.getAllSongs()
        
        // Try to restore saved order
        const savedOrder = loadSongOrder()
        if (savedOrder && savedOrder.length > 0) {
            // Sort songs according to saved order
            const songMap = new Map(storedSongs.map(s => [s.id, s]))
            const orderedSongs: Song[] = []
            
            // Add songs in saved order
            for (const id of savedOrder) {
                const song = songMap.get(id)
                if (song) {
                    orderedSongs.push(song)
                    songMap.delete(id)
                }
            }
            
            // Add any new songs not in the saved order
            for (const song of songMap.values()) {
                orderedSongs.push(song)
            }
            
            allSongs.value = orderedSongs
            songs.value = orderedSongs
        } else {
            allSongs.value = storedSongs
            songs.value = storedSongs
        }
    } catch (e) {
        console.error('Failed to load songs:', e)
    } finally {
        isLoadingSongs.value = false
    }
}

// Settings management
function loadSettings() {
    playerSettings.loadPlayerState()
    volume.value = playerSettings.volume.value
    isShuffled.value = playerSettings.isShuffled.value
    repeatMode.value = playerSettings.repeatMode.value
}

function saveSettings() {
    playerSettings.volume.value = volume.value
    playerSettings.isShuffled.value = isShuffled.value
    playerSettings.repeatMode.value = repeatMode.value
    playerSettings.savePlayerState(currentSong.value?.id, currentTime.value)
}

function loadAppSettings() {
    if (typeof window === 'undefined') return
    const saved = localStorage.getItem('uplayer_app_settings')
    if (saved) {
        try {
            const parsed = JSON.parse(saved)
            // Merge with defaults, keeping waveType as 'uniquewave' if not set
            settings.soundEnabled = parsed.soundEnabled ?? true
            settings.waveEnabled = parsed.waveEnabled ?? true
            settings.waveType = parsed.waveType ?? 'uniquewave'
            
            if (!settings.soundEnabled) {
                isMuted.value = true
                previousVolume.value = volume.value || 100
                volume.value = 0
            }
        } catch (e) { console.error('Failed to parse settings:', e) }
    }
}

function saveAppSettings() {
    if (typeof window !== 'undefined') {
        localStorage.setItem('uplayer_app_settings', JSON.stringify(settings))
    }
}

function toggleSetting(key: keyof typeof settings) {
    (settings as any)[key] = !settings[key]
    saveAppSettings()
    
    if (key === 'soundEnabled') {
        if (settings.soundEnabled) {
            // Restore volume
            volume.value = previousVolume.value || 100
            applyVolume(volume.value)
        } else {
            // Mute - save current volume and set to 0
            previousVolume.value = volume.value > 0 ? volume.value : 100
            volume.value = 0
            applyVolume(0)
        }
    }
}

function onWaveTypeChange(newValue?: string) {
    if (newValue) settings.waveType = newValue as typeof settings.waveType
    saveAppSettings()
    
    nextTick(() => {
        if (waveVisualizerRef.value) {
            if (settings.waveType === 'uniquewave') {
                waveVisualizerRef.value.stopWaveAnimation?.()
                waveVisualizerRef.value.inituniquewave?.()
            } else {
                waveVisualizerRef.value.destroyuniquewave?.()
                waveVisualizerRef.value.initWave?.()
                if (isPlaying.value) {
                    waveVisualizerRef.value.setWaveIdle?.(false)
                } else {
                    waveVisualizerRef.value.startIdleWaveAnimation?.()
                }
            }
        }
    })
}

// ============================================
// WEB AUDIO API PLAYER (Tauri mode)
// Completely bypasses HTMLAudioElement to fix
// WebKitGTK VBR MP3 duration/seeking issues
// ============================================

// Animation frame for visualization
let visualizationFrameId: number | null = null

// Setup Web Audio Player callbacks
function setupWebAudioPlayer() {
    // Time update callback
    webAudioPlayer.onTimeUpdate((time) => {
        currentTime.value = time
    })
    
    // Ended callback
    webAudioPlayer.onEnded(() => {
        handleEnded()
    })
}

// Start visualization loop
function startVisualization() {
    if (visualizationFrameId) {
        cancelAnimationFrame(visualizationFrameId)
    }
    
    const animate = () => {
        if (!webAudioPlayer.isPlaying.value) {
            audioIntensity.value = 0
            return
        }
        
        const data = webAudioPlayer.getFrequencyData()
        if (data) {
            // Calculate intensity
            let sum = 0
            for (let i = 0; i < data.length; i += 2) {
                sum += data[i]!
            }
            const avg = sum / (data.length / 2)
            const normalized = avg / 255
            
            // Smooth
            audioIntensity.value = audioIntensity.value * 0.7 + normalized * 0.3
            
            // Update wave visualizer
            if (settings.waveType === 'equalizer' && waveVisualizerRef.value) {
                waveVisualizerRef.value.updateWaveEqualizer?.(data)
            } else if (settings.waveType === 'uniquewave' && waveVisualizerRef.value) {
                waveVisualizerRef.value.updateuniquewaveAmplitude?.(audioIntensity.value, data)
            }
        }
        
        visualizationFrameId = requestAnimationFrame(animate)
    }
    
    visualizationFrameId = requestAnimationFrame(animate)
}

function stopVisualization() {
    if (visualizationFrameId) {
        cancelAnimationFrame(visualizationFrameId)
        visualizationFrameId = null
    }
    audioIntensity.value = 0
    
    if (waveVisualizerRef.value) {
        if (settings.waveType === 'equalizer') waveVisualizerRef.value.stopWaveEqualizer?.()
        else if (settings.waveType === 'uniquewave') waveVisualizerRef.value.updateuniquewaveAmplitude?.(0)
    }
}

// Song selection - uses Web Audio API for Tauri, HTMLAudioElement for web
async function selectSong(song: Song, autoPlay = true) {
    if (currentSong.value?.id === song.id) { 
        togglePlay()
        return 
    }

    // Stop current playback
    webAudioPlayer.stop()
    stopVisualization()
    
    // Reset all state
    isPlaying.value = false
    currentTime.value = 0
    duration.value = 0
    
    // Update song reference
    currentSong.value = song
    
    // Get ArrayBuffer for Web Audio API
    let arrayBuffer: ArrayBuffer | null = null
    
    if (tauriFS.isTauri.value) {
        // TAURI MODE: Read file directly
        if (song.id.startsWith('tauri-') || (!song.path.startsWith('blob:') && !song.path.startsWith('data:'))) {
            arrayBuffer = await tauriFS.getAudioArrayBuffer(song.path)
        }
    }
    
    // WEB MODE or legacy songs: Fetch from blob URL
    if (!arrayBuffer) {
        const songWithData = song as any
        let audioUrl = song.path
        
        if (songWithData._fileData && songWithData._fileType) {
            audioUrl = songStorage.createFreshAudioUrl(songWithData)
        }
        
        try {
            const response = await fetch(audioUrl)
            arrayBuffer = await response.arrayBuffer()
        } catch (e) {
            return
        }
    }
    
    if (!arrayBuffer) {
        return
    }
    
    // Load and decode with Web Audio API
    const success = await webAudioPlayer.loadAudio(arrayBuffer)
    
    if (!success) {
        return
    }
    
    // Update duration from Web Audio API (CORRECT value!)
    duration.value = webAudioPlayer.duration.value
    
    // Update metadata
    updateMediaSessionMetadata(song)
    
    // Auto-play if requested
    if (autoPlay) {
        webAudioPlayer.play()
        isPlaying.value = true
        startVisualization()
        startPositionTracking()
    }
    
    // Background tasks
    musicLibrary.addToRecent(song.id).catch(() => {})
}

function handleSongSelect(song: Song) {
    selectSong(song)
    playlistExpanded.value = false
}

// Playback controls - Web Audio API
function togglePlay() {
    if (!currentSong.value) return
    
    if (isPlaying.value) {
        webAudioPlayer.pause()
        isPlaying.value = false
        stopVisualization()
        stopPositionTracking()
    } else {
        webAudioPlayer.play()
        isPlaying.value = true
        startVisualization()
        startPositionTracking()
    }
}

function toggleShuffle() { isShuffled.value = !isShuffled.value }

function toggleRepeat() {
    repeatMode.value = repeatMode.value === 'off' ? 'all' : repeatMode.value === 'all' ? 'one' : 'off'
}

function playNext() {
    if (!songs.value.length || !currentSong.value || isNextAnimating.value) return
    isNextAnimating.value = true
    setTimeout(() => isNextAnimating.value = false, 400)

    if (isShuffled.value) {
        const others = songs.value.filter(s => s.id !== currentSong.value?.id)
        if (others.length) selectSong(others[Math.floor(Math.random() * others.length)]!)
    } else {
        const idx = songs.value.findIndex(s => s.id === currentSong.value?.id)
        selectSong(songs.value[(idx + 1) % songs.value.length]!)
    }
}

function playPrevious() {
    if (!songs.value.length || !currentSong.value || isPrevAnimating.value) return
    isPrevAnimating.value = true
    setTimeout(() => isPrevAnimating.value = false, 400)

    const idx = songs.value.findIndex(s => s.id === currentSong.value?.id)
    selectSong(songs.value[idx === 0 ? songs.value.length - 1 : idx - 1]!)
}

function seek(value: number) {
    webAudioPlayer.seek(value)
    currentTime.value = value
    mediaSessionPosition = value
    updateMediaSessionPositionState()
}

// Handle ended event
function handleEnded() {
    if (repeatMode.value === 'one') {
        webAudioPlayer.seek(0)
        webAudioPlayer.play()
    } else {
        const idx = songs.value.findIndex(s => s.id === currentSong.value?.id)
        if (repeatMode.value === 'all' || idx !== songs.value.length - 1) {
            playNext()
        } else {
            isPlaying.value = false
            stopVisualization()
            stopPositionTracking()
        }
    }
}

// Media Session position tracking
let mediaSessionPosition = 0
let positionInterval: ReturnType<typeof setInterval> | null = null

function startPositionTracking() {
    stopPositionTracking()
    mediaSessionPosition = currentTime.value
    mediaSession.updatePositionState(duration.value, mediaSessionPosition, 1.0)
    
    positionInterval = setInterval(() => {
        if (isPlaying.value) {
            mediaSessionPosition = webAudioPlayer.currentTime.value
            currentTime.value = mediaSessionPosition
            if (mediaSessionPosition <= duration.value) {
                mediaSession.updatePositionState(duration.value, mediaSessionPosition, 1.0)
            }
        }
    }, 250)
}

function stopPositionTracking() {
    if (positionInterval) {
        clearInterval(positionInterval)
        positionInterval = null
    }
}

// Media Session
function setupMediaSession() {
    mediaSession.setup({
        onPlay: () => { webAudioPlayer.play(); isPlaying.value = true; startVisualization(); startPositionTracking() },
        onPause: () => { webAudioPlayer.pause(); isPlaying.value = false; stopVisualization(); stopPositionTracking() },
        onPrevious: playPrevious,
        onNext: playNext,
        onSeekBackward: (t) => { seek(Math.max(0, currentTime.value - t)) },
        onSeekForward: (t) => { seek(Math.min(duration.value, currentTime.value + t)) },
        onSeekTo: (t) => { seek(t) },
        onStop: () => { webAudioPlayer.stop(); isPlaying.value = false; stopVisualization(); stopPositionTracking() }
    })
}

const updateMediaSessionMetadata = (song: Song) => mediaSession.updateMetadata({
    title: song.title,
    artist: song.artist,
    album: song.album,
    cover: song.cover || '/default.webp'
})

const updateMediaSessionPositionState = () => {
    if (duration.value > 0 && isFinite(duration.value)) {
        mediaSession.updatePositionState(duration.value, currentTime.value, 1.0)
    }
}

// Watchers - debounced saves
watch(volume, (v) => {
    applyVolume(v)
    // Debounce save
    requestAnimationFrame(() => {
        saveSettings()
        saveAppSettings()
    })
})
watch(isShuffled, () => requestAnimationFrame(saveSettings))
watch(repeatMode, () => requestAnimationFrame(saveSettings))
watch(currentTime, () => { 
    if (currentSong.value && currentTime.value > 0) {
        // Don't save on every time update - too frequent
    }
})

// Volume control function - directly set volume
function setVolume(v: number) {
    volume.value = v
    applyVolume(v)
}

// Apply volume to Web Audio API GainNode
function applyVolume(v: number) {
    const normalizedVolume = Math.max(0, Math.min(100, v)) / 100
    webAudioPlayer.setVolume(normalizedVolume)
    settings.soundEnabled = v > 0
}

// Tauri drag-drop cleanup function
let cleanupTauriDragDrop: (() => void) | null = null

// Lifecycle
onMounted(async () => {
    loadSettings()
    loadAppSettings()
    setupMediaSession()
    setupWebAudioPlayer() // Web Audio API callbacks
    
    // Initialize IndexedDB and load saved songs
    await songStorage.init()
    await loadAllSongs()
    await musicLibrary.init()

    // Apply initial volume
    applyVolume(volume.value)
    
    // Restore last played song
    const lastSongId = localStorage.getItem(STORAGE_KEYS.LAST_SONG_ID)
    if (lastSongId && songs.value.length > 0) {
        const lastSong = songs.value.find(s => s.id === lastSongId)
        if (lastSong) {
            selectSong(lastSong, false)
        }
    }

    // Setup Tauri event listeners
    if (tauriFS.isTauri.value) {
        // Listen for files opened via file association or CLI args
        try {
            const { listen } = await import('@tauri-apps/api/event')
            await listen<string[]>('open-files', async (event) => {
                const paths = event.payload
                if (paths && paths.length > 0) {
                    console.log('Open files received:', paths)
                    // Scan the files
                    const newSongs = await tauriFS.scanFiles(paths)
                    
                    // Store songs in IndexedDB
                    for (const song of newSongs) {
                        await songStorage.saveTauriSong(song)
                    }
                    
                    // Add to main library
                    addSongsToPlaylist(newSongs as any)
                    
                    // Set as "Now Playing" temp playlist
                    nowPlayingSongs.value = newSongs as Song[]
                    currentPlaylistId.value = '__now_playing__'
                    songs.value = [...nowPlayingSongs.value]
                    
                    // Auto-play the first song
                    if (newSongs.length > 0 && newSongs[0]) {
                        selectSong(newSongs[0] as any, true)
                    }
                }
            })
        } catch (e) {
            console.warn('Failed to setup open-files listener:', e)
        }

        // Setup drag-drop listener
        cleanupTauriDragDrop = await tauriFS.setupDragDropListener(async (paths: string[]) => {
            // Filter for audio files
            const audioExtensions = ['mp3', 'wav', 'flac', 'ogg', 'm4a', 'aac', 'opus']
            const audioPaths = paths.filter(path => {
                const ext = path.split('.').pop()?.toLowerCase()
                return ext && audioExtensions.includes(ext)
            })
            
            if (audioPaths.length > 0) {
                // Scan the dropped audio files
                const newSongs = await tauriFS.scanFiles(audioPaths)
                
                // Store songs in IndexedDB
                for (const song of newSongs) {
                    await songStorage.saveTauriSong(song)
                }
                
                // Add to playlist
                addSongsToPlaylist(newSongs as any)
            }
        })
    }
})

onUnmounted(() => {
    // Stop Web Audio API player
    webAudioPlayer.stop()
    stopVisualization()
    stopPositionTracking()
    
    // Cleanup Tauri drag-drop listener
    if (cleanupTauriDragDrop) {
        cleanupTauriDragDrop()
        cleanupTauriDragDrop = null
    }
})

useHead({
    title: 'Uplayer - Music Player',
    meta: [{ name: 'description', content: 'Uplayer - Modern desktop music player' }],
    bodyAttrs: { class: 'overflow-hidden' }
})
</script>

<style scoped>
.fade-enter-active,
.fade-leave-active {
    transition: opacity 0.2s ease;
}

.fade-enter-from,
.fade-leave-to {
    opacity: 0;
}
</style>
