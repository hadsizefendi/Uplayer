<template>
    <div class="flex flex-col flex-1 min-h-0 bg-black/90 rounded-t-3xl border-t border-white/10 will-change-transform">
        <!-- Playlist Toggle Button -->
        <button @click="$emit('toggle')"
            class="w-full py-3 px-4 flex items-center justify-center gap-2 text-white/80 hover:text-white transition-colors shrink-0 touch-manipulation">
            <UIcon name="i-heroicons-queue-list" class="text-lg" />
            <span>Playlist</span>
            <UIcon name="i-heroicons-chevron-up" :class="[
                'text-lg transition-transform duration-200',
                expanded ? 'rotate-180' : ''
            ]" />
        </button>

        <!-- Expandable Playlist Content - GPU accelerated -->
        <div ref="contentRef" class="playlist-content overflow-hidden"
            :class="expanded ? 'playlist-expanded' : 'playlist-collapsed'">

            <!-- Playlists Horizontal Scroll -->
            <div class="px-4">
                <div ref="playlistsScrollRef"
                    class="flex gap-2 overflow-x-auto scrollbar-hide pb-1 cursor-grab active:cursor-grabbing"
                    @wheel.prevent="handlePlaylistsWheel" @mousedown="startPlaylistDrag" @mousemove="onPlaylistDrag"
                    @mouseup="stopPlaylistDrag" @mouseleave="stopPlaylistDrag">
                    <!-- Create New Playlist Button -->
                    <UButton @click="showCreatePlaylist = true" variant="ghost" color="primary" icon="i-heroicons-plus"
                        class="shrink-0 rounded-full">
                        New Playlist
                    </UButton>

                    <!-- All Songs (default) -->
                    <UButton @click="$emit('selectPlaylist', null)"
                        :variant="currentPlaylistId === null ? 'subtle' : 'soft'"
                        :color="currentPlaylistId === null ? 'primary' : 'neutral'" icon="i-heroicons-musical-note"
                        class="shrink-0 rounded-full">
                        All Songs
                        <UBadge :label="String(totalSongCount)" size="sm" variant="subtle" class="ml-1" />
                    </UButton>

                    <!-- Favorites (fixed) -->
                    <UButton @click="$emit('selectPlaylist', 'favorites')"
                        :variant="currentPlaylistId === 'favorites' ? 'subtle' : 'soft'"
                        :color="currentPlaylistId === 'favorites' ? 'warning' : 'warning'" icon="i-heroicons-star-solid"
                        class="shrink-0 rounded-full">
                        Favorites
                        <UBadge :label="String(favoriteIds.length)" color="warning" size="sm" variant="subtle"
                            class="ml-1" />
                    </UButton>

                    <!-- Now Playing (temp playlist - only show if has songs) -->
                    <UButton v-if="nowPlayingSongs.length > 0" @click="$emit('selectPlaylist', '__now_playing__')"
                        :variant="currentPlaylistId === '__now_playing__' ? 'subtle' : 'soft'"
                        :color="currentPlaylistId === '__now_playing__' ? 'success' : 'success'"
                        icon="i-heroicons-play-circle" class="shrink-0 rounded-full">
                        Now Playing
                        <UBadge :label="String(nowPlayingSongs.length)" color="success" size="sm" variant="subtle"
                            class="ml-1" />
                    </UButton>

                    <!-- User Playlists -->
                    <UFieldGroup v-for="playlist in playlists" :key="playlist.id" class="shrink-0">
                        <UButton size="xs" class="rounded-full" variant="soft" icon="i-ph-pen"
                            @click.stop="openEditPlaylist(playlist)" />
                        <UButton @click="$emit('selectPlaylist', playlist.id)"
                            :variant="currentPlaylistId === playlist.id ? 'subtle' : 'soft'"
                            :color="currentPlaylistId === playlist.id ? 'neutral' : 'primary'"
                            class="rounded-full uppercase">
                            {{ playlist.name }}
                            <UBadge :label="String(playlist.songIds.length)" size="sm" variant="subtle" class="ml-1" />
                        </UButton>
                        <UButton @click.stop="confirmDeletePlaylist(playlist)" variant="soft" color="error"
                            icon="i-heroicons-trash" size="xs" class="rounded-full" />
                    </UFieldGroup>
                </div>
            </div>

            <!-- Create Playlist Modal -->
            <UModal v-model:open="showCreatePlaylist">
                <template #content>
                    <div class="p-6 bg-gray-900 rounded-xl">
                        <!-- Lottie Animation -->
                        <div class="flex justify-center mb-4">
                            <Vue3Lottie animationLink="/animations/add.json" :height="80" :width="80" :loop="true" />
                        </div>

                        <h3 class="text-lg font-semibold text-white mb-4 text-center">Create New Playlist</h3>
                        <UInput v-model="newPlaylistName" placeholder="Playlist name" autofocus class="mb-4 w-full" />

                        <!-- Song Selection -->
                        <div class="mb-4">
                            <div class="flex items-center justify-between mb-2">
                                <span class="text-sm text-white/70">Select songs to add</span>
                                <span class="text-xs text-white/50">{{ selectedSongsForNewPlaylist.length }}
                                    selected</span>
                            </div>
                            <div class="space-y-1 max-h-48 overflow-y-auto rounded-lg bg-black/20 p-2">
                                <label v-for="song in allAvailableSongs" :key="song.id"
                                    class="flex items-center gap-3 p-2 rounded-lg hover:bg-white/10 cursor-pointer transition-colors">
                                    <input type="checkbox" :value="song.id" v-model="selectedSongsForNewPlaylist"
                                        class="w-4 h-4 rounded border-white/30 bg-white/10 text-primary focus:ring-primary focus:ring-offset-0" />
                                    <div class="size-8 rounded-full overflow-hidden shrink-0">
                                        <img :src="song.cover || '/default.webp'" :alt="song.title"
                                            class="w-full h-full object-cover" loading="lazy" />
                                    </div>
                                    <span class="flex-1 text-white text-sm line-clamp-1">{{ song.title }}</span>
                                </label>
                                <div v-if="!allAvailableSongs.length" class="text-center py-4 text-white/50 text-sm">
                                    No songs in library
                                </div>
                            </div>
                        </div>

                        <div class="flex gap-2 justify-end">
                            <UButton class="w-full flex items-center justify-center" variant="ghost"
                                @click="closeCreatePlaylist">Cancel</UButton>
                            <UButton class="w-full flex items-center justify-center" color="primary"
                                @click="createPlaylist" :disabled="!newPlaylistName.trim()">
                                Create
                            </UButton>
                        </div>
                    </div>
                </template>
            </UModal>

            <!-- Delete Playlist Confirmation Modal -->
            <UModal v-model:open="showDeleteConfirm">
                <template #content>
                    <div class="p-6 bg-gray-900 rounded-xl">
                        <!-- Lottie Animation -->
                        <div class="flex justify-center mb-4">
                            <Vue3Lottie animationLink="/animations/trash.json" :height="80" :width="80" :loop="true" />
                        </div>
                        <h3 class="text-lg font-semibold text-white text-center mb-2">Delete Playlist</h3>
                        <p class="text-white/70 mb-6 text-center">
                            Are you sure you want to delete "<span class="text-white font-medium">{{
                                playlistToDelete?.name }}</span>"?
                            This action cannot be undone.
                        </p>
                        <div class="flex gap-2 justify-end">
                            <UButton class="w-full flex items-center justify-center" variant="ghost"
                                @click="showDeleteConfirm = false">Cancel</UButton>
                            <UButton class="w-full flex items-center justify-center" color="error"
                                @click="executeDeletePlaylist">Delete</UButton>
                        </div>
                    </div>
                </template>
            </UModal>

            <!-- Edit Playlist Modal -->
            <UModal v-model:open="showEditPlaylist">
                <template #content>
                    <div class="p-6 bg-gray-900 rounded-xl">
                        <!-- Lottie Animation -->
                        <div class="flex justify-center mb-4">
                            <Vue3Lottie animationLink="/animations/edit.json" :height="80" :width="80" :loop="true" />
                        </div>

                        <h3 class="text-lg font-semibold text-white mb-4 text-center">Edit Playlist</h3>
                        <UInput v-model="editPlaylistName" placeholder="Playlist name" autofocus class="mb-4 w-full" />

                        <!-- Song Selection -->
                        <div class="mb-4">
                            <div class="flex items-center justify-between mb-2">
                                <span class="text-sm text-white/70">Songs in playlist</span>
                                <span class="text-xs text-white/50">{{ editPlaylistSongIds.length }} selected</span>
                            </div>
                            <div class="space-y-1 max-h-48 overflow-y-auto rounded-lg bg-black/20 p-2">
                                <label v-for="song in allAvailableSongs" :key="song.id"
                                    class="flex items-center gap-3 p-2 rounded-lg hover:bg-white/10 cursor-pointer transition-colors">
                                    <input type="checkbox" :value="song.id" v-model="editPlaylistSongIds"
                                        class="w-4 h-4 rounded border-white/30 bg-white/10 text-primary focus:ring-primary focus:ring-offset-0" />
                                    <div class="size-8 rounded-full overflow-hidden shrink-0">
                                        <img :src="song.cover || '/default.webp'" :alt="song.title"
                                            class="w-full h-full object-cover" loading="lazy" />
                                    </div>
                                    <span class="flex-1 text-white text-sm line-clamp-1">{{ song.title }}</span>
                                </label>
                                <div v-if="!allAvailableSongs.length" class="text-center py-4 text-white/50 text-sm">
                                    No songs in library
                                </div>
                            </div>
                        </div>

                        <div class="flex gap-2 justify-end">
                            <UButton class="w-full flex items-center justify-center" variant="ghost"
                                @click="closeEditPlaylist">Cancel</UButton>
                            <UButton class="w-full flex items-center justify-center" color="primary"
                                @click="saveEditPlaylist" :disabled="!editPlaylistName.trim()">
                                Save
                            </UButton>
                        </div>
                    </div>
                </template>
            </UModal>

            <!-- Delete Song Confirmation Modal -->
            <UModal v-model:open="showDeleteSongConfirm">
                <template #content>
                    <div class="p-6 bg-gray-900 rounded-xl">
                        <!-- Lottie Animation -->
                        <div class="flex justify-center mb-4">
                            <Vue3Lottie animationLink="/animations/trash.json" :height="80" :width="80" :loop="true" />
                        </div>
                        <h3 class="text-lg font-semibold text-white text-center mb-2">Delete Song</h3>
                        <p class="text-white/70 mb-6 text-center">
                            Are you sure you want to delete "<span class="text-white font-medium">{{
                                songToDelete?.title }}</span>"?
                            This will remove the song from your library permanently.
                        </p>
                        <div class="flex gap-2 justify-end">
                            <UButton class="w-full flex items-center justify-center" variant="ghost"
                                @click="showDeleteSongConfirm = false">Cancel</UButton>
                            <UButton class="w-full flex items-center justify-center" color="error"
                                @click="executeDeleteSong">Delete</UButton>
                        </div>
                    </div>
                </template>
            </UModal>

            <!-- Add to Playlist Modal -->
            <UModal v-model:open="showAddToPlaylist">
                <template #content>
                    <div class="p-6 bg-gray-900 rounded-xl min-w-80">
                        <div class="flex items-center gap-3 mb-4">
                            <div class="size-10 rounded-full bg-primary/20 flex items-center justify-center">
                                <UIcon name="i-heroicons-plus-circle" class="text-primary text-lg" />
                            </div>
                            <div>
                                <h3 class="text-lg font-semibold text-white">Add to Playlist</h3>
                                <p class="text-sm text-white/50 line-clamp-1">{{ songToAdd?.title }}</p>
                            </div>
                        </div>

                        <!-- Playlist List -->
                        <div class="space-y-2 max-h-64 overflow-y-auto mb-4">
                            <div v-if="!playlists.length" class="text-center py-4 text-white/50">
                                No playlists yet. Create one first!
                            </div>
                            <label v-for="playlist in playlists" :key="playlist.id"
                                class="flex items-center gap-3 p-3 rounded-lg bg-white/5 hover:bg-white/10 cursor-pointer transition-colors">
                                <input type="checkbox" :value="playlist.id" v-model="selectedPlaylists"
                                    class="w-4 h-4 rounded border-white/30 bg-white/10 text-primary focus:ring-primary focus:ring-offset-0" />
                                <UIcon name="i-heroicons-queue-list" class="text-blue-400" />
                                <span class="flex-1 text-white text-sm">{{ playlist.name }}</span>
                                <span class="text-xs text-white/50">({{ playlist.songIds.length }})</span>
                                <UIcon v-if="isSongInPlaylist(playlist)" name="i-heroicons-check-circle-solid"
                                    class="text-green-400 text-sm" />
                            </label>
                        </div>

                        <div class="flex gap-2 justify-end">
                            <UButton class="w-full flex items-center justify-center" variant="ghost"
                                @click="showAddToPlaylist = false">Cancel</UButton>
                            <UButton class="w-full flex items-center justify-center" color="primary"
                                @click="addToSelectedPlaylists" :disabled="!selectedPlaylists.length">
                                Add to {{ selectedPlaylists.length }} playlist{{ selectedPlaylists.length !== 1 ? 's' :
                                    '' }}
                            </UButton>
                        </div>
                    </div>
                </template>
            </UModal>

            <!-- Scrollable Playlist -->
            <div ref="playlistScrollContainer" data-scrollbar
                class="relative rounded-3xl overflow-hidden mx-3.5 pb-safe h-[55vh]">
                <div
                    class="scroll-content space-y-1.5 p-4 h-full overflow-y-auto overscroll-contain gradient-mask-horizontal-low">
                    <!-- Add Songs Button -->
                    <div @click="handleAddFilesClick"
                        class="cursor-pointer rounded-xl p-2.5 transition-colors duration-150 touch-manipulation bg-white/5 hover:bg-white/10 active:bg-white/15 flex items-center gap-2.5 border border-dashed border-white/20">
                        <input v-if="!isTauri" ref="fileInputRef" type="file" accept="audio/*" multiple class="hidden"
                            @change="handleFileSelect" />
                        <div class="size-10 shrink-0 rounded-full bg-white/10 flex items-center justify-center">
                            <UIcon name="i-heroicons-plus" class="text-white/70 text-lg" />
                        </div>
                        <div class="flex-1 min-w-0">
                            <h3 class="font-semibold text-sm text-white/70">Add Songs</h3>
                            <p class="text-xs text-white/40">Click to select files</p>
                        </div>
                    </div>

                    <!-- Song List -->
                    <div v-for="(song, index) in songs" :key="song.id" :data-song-index="index"
                        @click="handleSongClick(song)" :class="[
                            'song-item cursor-pointer rounded-xl p-2.5 transition-all duration-150 select-none',
                            currentSong?.id === song.id ? 'bg-primary/20 ring-2 ring-primary' : 'bg-white/5 active:bg-white/10',
                            dragOverIndex === index && draggedIndex !== index ? 'ring-2 ring-primary/50 bg-primary/10 scale-[1.02]' : '',
                            draggedIndex === index ? 'opacity-50 scale-95' : ''
                        ]">
                        <div class="flex items-center gap-2.5 relative">
                            <!-- Drag Handle -->
                            <div class="drag-handle shrink-0 cursor-grab active:cursor-grabbing text-white/30 hover:text-white/50 flex items-center justify-center py-2"
                                @mousedown.stop="startDrag($event, index)"
                                @touchstart.stop.prevent="startTouchDrag($event, index)">
                                <UIcon name="i-heroicons-bars-3" class="text-base size-4 pointer-events-none" />
                            </div>
                            <div :class="[
                                'relative size-10 shrink-0 rounded-full overflow-hidden ring-2 ring-gray-800',
                                currentSong?.id === song.id && isPlaying ? 'animate-spin-slow ring-black' : ''
                            ]">
                                <img :src="song.cover || '/default.webp'" :alt="song.title"
                                    class="w-full h-full object-cover" loading="lazy" />
                                <div class="absolute inset-0 pointer-events-none">
                                    <div class="absolute inset-[35%] rounded-full border-2 border-gray-700/50"></div>
                                    <div
                                        class="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-2 h-2 rounded-full bg-gray-900">
                                    </div>
                                </div>
                            </div>
                            <div class="flex-1 min-w-0">
                                <h3 :class="[
                                    'font-semibold line-clamp-1 text-sm',
                                    currentSong?.id === song.id ? 'text-primary' : 'text-white'
                                ]">
                                    {{ song.title }}
                                </h3>
                            </div>
                            <!-- Favorite Button -->
                            <UButton @click.stop="$emit('toggleFavorite', song.id)"
                                class="p-1.5 rounded-full hover:bg-white/10 transition-colors" variant="ghost">
                                <UIcon
                                    :name="favoriteIds.includes(song.id) ? 'i-heroicons-star-solid' : 'i-heroicons-star'"
                                    :class="[
                                        'text-lg transition-colors',
                                        favoriteIds.includes(song.id) ? 'text-yellow-400' : 'text-white/30 hover:text-white/50'
                                    ]" />
                            </UButton>

                            <UButton @click.stop="openAddToPlaylist(song)"
                                class="absolute left-7.5 rounded-full text-primary/50 hover:text-white transition-colors"
                                variant="ghost" icon="i-heroicons-plus-circle" />

                            <!-- Delete Song Button -->
                            <UButton @click.stop="confirmDeleteSong(song)"
                                class="p-1.5 rounded-full hover:bg-red-500/20 transition-colors" variant="ghost">
                                <UIcon name="i-heroicons-trash"
                                    class="text-lg text-white/30 hover:text-red-400 transition-colors" />
                            </UButton>
                            <UBadge :label="song.durationFormatted || formatDuration(song.duration)" size="xs" variant="subtle" class="w-8 flex items-center text-center justify-center" />
                        </div>
                    </div>
                </div>
            </div>
        </div>
    </div>
</template>

<script setup lang="ts">
import { Vue3Lottie } from 'vue3-lottie'

interface PlaylistItem {
    id: string
    name: string
    songIds: readonly string[] | string[]
    createdAt: number
    updatedAt: number
}

const props = defineProps<{
    songs: any[];
    currentSong: any;
    isPlaying: boolean;
    expanded: boolean;
    playlists: readonly PlaylistItem[];
    currentPlaylistId: string | null;
    favoriteIds: readonly string[];
    totalSongCount: number;
    allAvailableSongs: any[];
    nowPlayingSongs: any[];
}>();

const emit = defineEmits<{
    toggle: [];
    selectSong: [song: any];
    addFiles: [files: File[]];
    addTauriFiles: [];  // Tauri mode - parent will open dialog
    createPlaylist: [name: string, songIds: string[]];
    editPlaylist: [playlistId: string, name: string, songIds: string[]];
    selectPlaylist: [playlistId: string | null];
    deletePlaylist: [playlistId: string];
    toggleFavorite: [songId: string];
    addToPlaylists: [songId: string, playlistIds: string[]];
    deleteSong: [songId: string];
    reorderSongs: [fromIndex: number, toIndex: number];
}>();

const playlistScrollContainer = ref<HTMLElement>();
const playlistsScrollRef = ref<HTMLElement>();
const contentRef = ref<HTMLElement>();
const fileInputRef = ref<HTMLInputElement>();

// Check if running in Tauri
const isTauri = computed(() => typeof window !== 'undefined' && '__TAURI__' in window)

// Handle horizontal scroll with mouse wheel for playlists
function handlePlaylistsWheel(event: WheelEvent) {
    if (playlistsScrollRef.value) {
        playlistsScrollRef.value.scrollLeft += event.deltaY
    }
}

// Drag to scroll for playlists
let isPlaylistDragging = false
let playlistDragStartX = 0
let playlistScrollStartLeft = 0

function startPlaylistDrag(event: MouseEvent) {
    if (!playlistsScrollRef.value) return
    isPlaylistDragging = true
    playlistDragStartX = event.pageX
    playlistScrollStartLeft = playlistsScrollRef.value.scrollLeft
}

function onPlaylistDrag(event: MouseEvent) {
    if (!isPlaylistDragging || !playlistsScrollRef.value) return
    event.preventDefault()
    const deltaX = event.pageX - playlistDragStartX
    playlistsScrollRef.value.scrollLeft = playlistScrollStartLeft - deltaX
}

function stopPlaylistDrag() {
    isPlaylistDragging = false
}

// Create playlist modal
const showCreatePlaylist = ref(false)
const newPlaylistName = ref('')
const selectedSongsForNewPlaylist = ref<string[]>([])

// Delete playlist modal
const showDeleteConfirm = ref(false)
const playlistToDelete = ref<PlaylistItem | null>(null)

// Edit playlist modal
const showEditPlaylist = ref(false)
const playlistToEdit = ref<PlaylistItem | null>(null)
const editPlaylistName = ref('')
const editPlaylistSongIds = ref<string[]>([])

function openEditPlaylist(playlist: PlaylistItem) {
    playlistToEdit.value = playlist
    editPlaylistName.value = playlist.name
    editPlaylistSongIds.value = [...playlist.songIds]
    showEditPlaylist.value = true
}

function closeEditPlaylist() {
    playlistToEdit.value = null
    editPlaylistName.value = ''
    editPlaylistSongIds.value = []
    showEditPlaylist.value = false
}

function saveEditPlaylist() {
    if (playlistToEdit.value && editPlaylistName.value.trim()) {
        emit('editPlaylist', playlistToEdit.value.id, editPlaylistName.value.trim(), editPlaylistSongIds.value)
        closeEditPlaylist()
    }
}

// Delete song modal
const showDeleteSongConfirm = ref(false)
const songToDelete = ref<any>(null)

function confirmDeleteSong(song: any) {
    songToDelete.value = song
    showDeleteSongConfirm.value = true
}

function executeDeleteSong() {
    if (songToDelete.value) {
        emit('deleteSong', songToDelete.value.id)
        songToDelete.value = null
        showDeleteSongConfirm.value = false
    }
}

// Add to playlist modal
const showAddToPlaylist = ref(false)
const songToAdd = ref<any>(null)
const selectedPlaylists = ref<string[]>([])

function openAddToPlaylist(song: any) {
    songToAdd.value = song
    // Pre-select playlists that already contain this song
    selectedPlaylists.value = props.playlists
        .filter(p => p.songIds.includes(song.id))
        .map(p => p.id)
    showAddToPlaylist.value = true
}

function isSongInPlaylist(playlist: PlaylistItem): boolean {
    if (!songToAdd.value) return false
    return playlist.songIds.includes(songToAdd.value.id)
}

function addToSelectedPlaylists() {
    if (songToAdd.value && selectedPlaylists.value.length) {
        emit('addToPlaylists', songToAdd.value.id, selectedPlaylists.value)
        showAddToPlaylist.value = false
        songToAdd.value = null
        selectedPlaylists.value = []
    }
}

function createPlaylist() {
    if (newPlaylistName.value.trim()) {
        emit('createPlaylist', newPlaylistName.value.trim(), selectedSongsForNewPlaylist.value)
        newPlaylistName.value = ''
        selectedSongsForNewPlaylist.value = []
        showCreatePlaylist.value = false
    }
}

function closeCreatePlaylist() {
    newPlaylistName.value = ''
    selectedSongsForNewPlaylist.value = []
    showCreatePlaylist.value = false
}

function confirmDeletePlaylist(playlist: PlaylistItem) {
    playlistToDelete.value = playlist
    showDeleteConfirm.value = true
}

function executeDeletePlaylist() {
    if (playlistToDelete.value) {
        emit('deletePlaylist', playlistToDelete.value.id)
        playlistToDelete.value = null
        showDeleteConfirm.value = false
    }
}

// Format duration helper
function formatDuration(seconds: number): string {
    if (!seconds || !isFinite(seconds)) return '0:00'
    const mins = Math.floor(seconds / 60)
    const secs = Math.floor(seconds % 60)
    return `${mins}:${secs.toString().padStart(2, '0')}`
}

// Song click handler (prevent click during drag)
let isDragging = false

function handleSongClick(song: any) {
    if (!isDragging) {
        emit('selectSong', song)
    }
}

// Drag and drop state
const draggedIndex = ref<number | null>(null)
const dragOverIndex = ref<number | null>(null)

// Drag clone element
let dragClone: HTMLElement | null = null
let dragStartY = 0
let dragOffsetY = 0
let animationFrame: number | null = null

// Create visual clone of dragged item
function createDragClone(sourceElement: HTMLElement, clientY: number) {
    const rect = sourceElement.getBoundingClientRect()
    dragOffsetY = clientY - rect.top
    dragStartY = clientY

    dragClone = sourceElement.cloneNode(true) as HTMLElement
    dragClone.classList.add('drag-clone')
    dragClone.style.cssText = `
        position: fixed;
        left: ${rect.left}px;
        top: ${rect.top}px;
        width: ${rect.width}px;
        height: ${rect.height}px;
        z-index: 9999;
        pointer-events: none;
        opacity: 0.95;
        transform: scale(1.02);
        box-shadow: 0 10px 40px rgba(0, 0, 0, 0.4), 0 0 0 1px rgba(var(--color-primary-500), 0.5);
        border-radius: 0.75rem;
        background: rgba(0, 0, 0, 0.9);
        backdrop-filter: blur(8px);
        will-change: transform;
        transition: transform 0.1s ease, box-shadow 0.1s ease;
    `
    document.body.appendChild(dragClone)
}

// Move clone smoothly
function moveDragClone(clientY: number) {
    if (!dragClone) return

    if (animationFrame) cancelAnimationFrame(animationFrame)

    animationFrame = requestAnimationFrame(() => {
        if (dragClone) {
            const newTop = clientY - dragOffsetY
            dragClone.style.top = `${newTop}px`
        }
    })
}

// Remove clone with animation
function removeDragClone() {
    if (animationFrame) {
        cancelAnimationFrame(animationFrame)
        animationFrame = null
    }

    if (dragClone) {
        dragClone.style.transition = 'opacity 0.15s ease, transform 0.15s ease'
        dragClone.style.opacity = '0'
        dragClone.style.transform = 'scale(0.95)'

        setTimeout(() => {
            dragClone?.remove()
            dragClone = null
        }, 150)
    }
}

// Mouse drag
function startDrag(event: MouseEvent, index: number) {
    event.preventDefault()
    isDragging = true
    draggedIndex.value = index

    // Find the song item element
    const songItem = (event.target as HTMLElement).closest('.song-item') as HTMLElement
    if (songItem) {
        createDragClone(songItem, event.clientY)
    }

    function onMouseMove(e: MouseEvent) {
        moveDragClone(e.clientY)
        updateDragPosition(e.clientY)
    }

    function onMouseUp() {
        document.removeEventListener('mousemove', onMouseMove)
        document.removeEventListener('mouseup', onMouseUp)
        finishDrag()
    }

    document.addEventListener('mousemove', onMouseMove)
    document.addEventListener('mouseup', onMouseUp)

    // Haptic feedback
    if (navigator.vibrate) navigator.vibrate(30)
}

// Touch drag
function startTouchDrag(event: TouchEvent, index: number) {
    isDragging = true
    draggedIndex.value = index

    const touch = event.touches[0]
    if (!touch) return

    // Find the song item element
    const songItem = (event.target as HTMLElement).closest('.song-item') as HTMLElement
    if (songItem) {
        createDragClone(songItem, touch.clientY)
    }

    function onTouchMove(e: TouchEvent) {
        e.preventDefault()
        const t = e.touches[0]
        if (t) {
            moveDragClone(t.clientY)
            updateDragPosition(t.clientY)
        }
    }

    function onTouchEnd() {
        document.removeEventListener('touchmove', onTouchMove)
        document.removeEventListener('touchend', onTouchEnd)
        finishDrag()
    }

    document.addEventListener('touchmove', onTouchMove, { passive: false })
    document.addEventListener('touchend', onTouchEnd)

    // Haptic feedback
    if (navigator.vibrate) navigator.vibrate(30)
}

// Update drag position and find target
function updateDragPosition(clientY: number) {
    const scrollContent = playlistScrollContainer.value?.querySelector('.scroll-content') as HTMLElement
    if (!scrollContent) return

    const items = scrollContent.querySelectorAll('.song-item')
    let newOverIndex: number | null = null

    items.forEach((item, idx) => {
        const rect = item.getBoundingClientRect()
        const midY = rect.top + rect.height / 2

        // Check if cursor is over this item
        if (clientY >= rect.top && clientY <= rect.bottom) {
            // Determine if we're in the top or bottom half
            if (draggedIndex.value !== null) {
                if (idx < draggedIndex.value && clientY < midY) {
                    newOverIndex = idx
                } else if (idx > draggedIndex.value && clientY > midY) {
                    newOverIndex = idx
                } else if (idx !== draggedIndex.value) {
                    newOverIndex = idx
                }
            }
        }
    })

    if (newOverIndex !== null && newOverIndex !== dragOverIndex.value) {
        dragOverIndex.value = newOverIndex
        // Haptic feedback on target change
        if (navigator.vibrate) navigator.vibrate(10)
    }

    // Auto-scroll if near edges
    const scrollRect = scrollContent.getBoundingClientRect()
    const scrollThreshold = 60
    const scrollSpeed = 12

    if (clientY < scrollRect.top + scrollThreshold) {
        const intensity = 1 - (clientY - scrollRect.top) / scrollThreshold
        scrollContent.scrollTop -= scrollSpeed * intensity
    } else if (clientY > scrollRect.bottom - scrollThreshold) {
        const intensity = 1 - (scrollRect.bottom - clientY) / scrollThreshold
        scrollContent.scrollTop += scrollSpeed * intensity
    }
}

// Finish drag and emit reorder
function finishDrag() {
    removeDragClone()

    if (draggedIndex.value !== null && dragOverIndex.value !== null && draggedIndex.value !== dragOverIndex.value) {
        emit('reorderSongs', draggedIndex.value, dragOverIndex.value)
        // Success haptic
        if (navigator.vibrate) navigator.vibrate([30, 50, 30])
    }

    draggedIndex.value = null
    dragOverIndex.value = null

    // Reset isDragging after a short delay to prevent click
    setTimeout(() => {
        isDragging = false
    }, 100)
}

// Handle file selection
function handleFileSelect(event: Event) {
    const input = event.target as HTMLInputElement
    if (!input.files?.length) return

    const files = Array.from(input.files)
    emit('addFiles', files)

    // Reset input for next selection
    input.value = ''
}

// Handle add files click - different behavior for Tauri vs Web
function handleAddFilesClick() {
    if (isTauri.value) {
        // Tauri mode - emit event for parent to open Tauri dialog
        emit('addTauriFiles')
    } else {
        // Web mode - trigger file input
        fileInputRef.value?.click()
    }
}

// Scrollbar state
let scrollbarInitialized = false;
let updatePathFn: (() => void) | null = null;

// Initialize curved scrollbar for playlist
function initCurvedScrollbar(container: HTMLElement) {
    if (scrollbarInitialized) return;
    scrollbarInitialized = true;

    const content = container.querySelector('.scroll-content') as HTMLElement;
    if (!content) return;

    const OFFSET = 7;
    const EXTRA_INSET = 2;
    const MIN_START_RATIO = 0.8;
    const MIN_THUMB = 20;
    const SEGMENTS = 30;

    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.classList.add('scrollbar-svg');
    svg.setAttribute('aria-hidden', 'true');

    const trackPath = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    trackPath.classList.add('scrollbar-track');

    const thumbPath = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    thumbPath.classList.add('scrollbar-thumb');

    svg.appendChild(trackPath);
    svg.appendChild(thumbPath);
    container.appendChild(svg);

    let pathLength = 0;
    let thumbLength = 50;
    let dragging = false;
    let pointerId: number | null = null;
    let rafId: number | null = null;

    function updatePath() {
        const w = container.clientWidth;
        const h = container.clientHeight;
        
        // Skip update if container has no size (collapsed)
        if (w === 0 || h === 0) return;
        
        const r = parseFloat(getComputedStyle(container).borderRadius) || 0;

        const effectiveRadius = Math.max(r - OFFSET, 0);
        const trackX = w - OFFSET;
        const topY = OFFSET;
        const bottomY = h - OFFSET;
        const cornerX = trackX - effectiveRadius;

        const minStartX = w * MIN_START_RATIO;
        let startX = trackX - effectiveRadius * EXTRA_INSET;
        if (startX < minStartX) startX = minStartX;
        if (startX > cornerX) startX = cornerX;

        const d = `M ${startX} ${topY} L ${cornerX} ${topY} A ${effectiveRadius} ${effectiveRadius} 0 0 1 ${trackX} ${topY + effectiveRadius} L ${trackX} ${bottomY - effectiveRadius} A ${effectiveRadius} ${effectiveRadius} 0 0 1 ${cornerX} ${bottomY} L ${startX} ${bottomY}`;
        trackPath.setAttribute('d', d);

        pathLength = trackPath.getTotalLength();
        const ratio = content.clientHeight / content.scrollHeight;
        thumbLength = Math.max(MIN_THUMB, pathLength * ratio);

        updateThumb();
    }
    
    // Expose updatePath for external calls
    updatePathFn = updatePath;

    function updateThumb() {
        if (rafId) return;
        rafId = requestAnimationFrame(() => {
            rafId = null;
            
            // Skip if no valid path
            if (pathLength === 0) return;
            
            const scrollableHeight = content.scrollHeight - content.clientHeight || 1;
            const scrollRatio = content.scrollTop / scrollableHeight;
            const startOffset = (pathLength - thumbLength) * scrollRatio;
            const endOffset = startOffset + thumbLength;

            const points = [];
            for (let i = 0; i <= SEGMENTS; i++) {
                const t = startOffset + ((endOffset - startOffset) / SEGMENTS) * i;
                const p = trackPath.getPointAtLength(t);
                points.push(`${p.x} ${p.y}`);
            }

            const segmentD = `M ${points[0]} ${points.slice(1).map(pt => `L ${pt}`).join(' ')}`;
            thumbPath.setAttribute('d', segmentD);
        });
    }

    thumbPath.addEventListener('pointerdown', (e) => {
        e.preventDefault();
        dragging = true;
        pointerId = e.pointerId;
        thumbPath.setPointerCapture(pointerId);
    }, { passive: false });

    window.addEventListener('pointermove', (e) => {
        if (!dragging || e.pointerId !== pointerId) return;
        const rect = container.getBoundingClientRect();
        let ratio = (e.clientY - rect.top) / rect.height;
        ratio = Math.max(0, Math.min(1, ratio));
        content.scrollTop = ratio * (content.scrollHeight - content.clientHeight);
    }, { passive: true });

    window.addEventListener('pointerup', (e) => {
        if (!dragging || e.pointerId !== pointerId) return;
        dragging = false;
        try { thumbPath.releasePointerCapture(pointerId!); } catch { }
        pointerId = null;
    });

    content.addEventListener('scroll', updateThumb, { passive: true });

    let resizeTimeout: ReturnType<typeof setTimeout>;
    window.addEventListener('resize', () => {
        clearTimeout(resizeTimeout);
        resizeTimeout = setTimeout(updatePath, 100);
    }, { passive: true });

    updatePath();
}

// Watch expanded state to recalculate scrollbar
watch(() => props.expanded, (expanded) => {
    if (expanded && playlistScrollContainer.value) {
        // Wait for CSS transition to complete before recalculating
        setTimeout(() => {
            if (updatePathFn) {
                updatePathFn();
            }
        }, 300); // Match the CSS transition duration
    }
});

// Also watch songs array changes to update scrollbar thumb size
watch(() => props.songs.length, () => {
    if (props.expanded && updatePathFn) {
        nextTick(() => {
            setTimeout(() => updatePathFn?.(), 50);
        });
    }
});

onMounted(() => {
    if (playlistScrollContainer.value) {
        // Initialize immediately if expanded, otherwise wait
        if (props.expanded) {
            initCurvedScrollbar(playlistScrollContainer.value);
        } else {
            // Defer initialization until first expansion
            const unwatch = watch(() => props.expanded, (expanded) => {
                if (expanded && playlistScrollContainer.value) {
                    initCurvedScrollbar(playlistScrollContainer.value);
                    // Wait for expansion animation then update
                    setTimeout(() => updatePathFn?.(), 300);
                    unwatch();
                }
            });
        }
    }
});
</script>

<style scoped>
.playlist-content {
    will-change: transform, opacity;
    transform-origin: top center;
}

.playlist-collapsed {
    max-height: 0;
    opacity: 0;
    transform: scaleY(0.95) translateY(-10px);
    pointer-events: none;
    transition: max-height 0.2s ease-out, opacity 0.15s ease-out, transform 0.2s ease-out;
}

.playlist-expanded {
    max-height: 65vh;
    opacity: 1;
    transform: scaleY(1) translateY(0);
    pointer-events: auto;
    transition: max-height 0.25s ease-out, opacity 0.2s ease-in 0.05s, transform 0.25s ease-out;
}

.scrollbar-hide {
    -ms-overflow-style: none;
    scrollbar-width: none;
}

.scrollbar-hide::-webkit-scrollbar {
    display: none;
}

/* Drag and drop styles */
.song-item {
    transition: transform 0.2s cubic-bezier(0.2, 0, 0, 1),
        opacity 0.2s ease,
        background-color 0.2s ease,
        box-shadow 0.2s ease,
        margin 0.2s cubic-bezier(0.2, 0, 0, 1);
    will-change: transform, opacity;
}

.drag-handle {
    touch-action: none;
    -webkit-touch-callout: none;
    -webkit-user-select: none;
    user-select: none;
    border-radius: 0.375rem;
    transition: background 0.15s ease, transform 0.15s ease;
}

.drag-handle:hover {
    background: rgba(255, 255, 255, 0.1);
}

.drag-handle:active {
    background: rgba(255, 255, 255, 0.2);
    transform: scale(1.1);
}

/* Global drag clone styles - not scoped */
</style>

<style>
.drag-clone {
    animation: dragCloneAppear 0.15s cubic-bezier(0.2, 0, 0, 1);
}

@keyframes dragCloneAppear {
    from {
        opacity: 0;
        transform: scale(0.95);
    }

    to {
        opacity: 0.95;
        transform: scale(1.02);
    }
}
</style>
