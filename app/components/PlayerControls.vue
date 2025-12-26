<template>
    <div v-if="currentSong" :class="[
        'w-full transition-all duration-500',
        compact ? 'px-6' : 'px-4'
    ]">
        <!-- Progress Bar -->
        <div :class="['pt-2', compact ? 'pb-1' : 'pb-0']">
            <div ref="progressBarRef" 
                class="relative h-1.5 bg-white/10 rounded-full overflow-hidden cursor-pointer group"
                @mousedown="startDrag"
                @touchstart.prevent="startDrag">
                <div :class="[
                    'absolute inset-y-0 left-0 bg-linear-to-r from-violet-500 to-cyan-500 rounded-full',
                    isDragging ? '' : 'transition-[width] duration-100'
                ]"
                    :style="{ width: progressPercent + '%' }">
                    <div :class="[
                        'absolute right-0 top-1/2 -translate-y-1/2 w-3 h-3 bg-white rounded-full shadow-lg',
                        isDragging ? 'opacity-100 scale-125' : 'opacity-0 group-hover:opacity-100'
                    ]"></div>
                </div>
            </div>
            <div class="flex justify-between text-xs text-gray-400 mt-1">
                <span>{{ formatTime(isDragging ? dragTime : currentTime) }}</span>
                <span>{{ formatTime(duration) }}</span>
            </div>
        </div>

        <!-- Modern Controls - Fixed sizes -->
        <div :class="[
            'flex items-center justify-center gap-4',
            compact ? 'py-1' : 'py-2'
        ]">
            <!-- Shuffle Button -->
            <button @click="$emit('toggleShuffle')"
                :class="[
                    'w-10 h-10 rounded-full backdrop-blur-lg bg-white/5 flex items-center justify-center transition-all duration-300',
                    isShuffled 
                        ? 'shadow-[inset_0.2rem_0.2rem_0.5rem_rgba(0,0,0,0.6),inset_-0.2rem_-0.2rem_0.5rem_rgba(255,255,255,0.1)] text-violet-400' 
                        : 'shadow-[0.3rem_0.3rem_0.6rem_rgba(0,0,0,0.4),-0.2rem_-0.2rem_0.5rem_rgba(255,255,255,0.1)] active:shadow-[inset_0.2rem_0.2rem_0.5rem_rgba(0,0,0,0.6),inset_-0.2rem_-0.2rem_0.5rem_rgba(255,255,255,0.1)] text-gray-300'
                ]">
                <UIcon name="i-solar-shuffle-line-duotone" :class="[
                    'text-lg transition-all duration-300',
                    isShuffled ? 'rotate-x-180' : ''
                ]" />
            </button>

            <!-- Previous Button -->
            <button @click="$emit('playPrevious')"
                class="w-12 h-12 rounded-full backdrop-blur-lg bg-white/5 flex items-center justify-center transition-all overflow-hidden shadow-[0.3rem_0.3rem_0.6rem_rgba(0,0,0,0.4),-0.2rem_-0.2rem_0.5rem_rgba(255,255,255,0.1)] active:shadow-[inset_0.2rem_0.2rem_0.5rem_rgba(0,0,0,0.6),inset_-0.2rem_-0.2rem_0.5rem_rgba(255,255,255,0.1)] active:scale-95">
                <UIcon name="i-solar-rewind-forward-bold-duotone" :class="[
                    'text-xl text-gray-300 rotate-180',
                    isPlaying && isPrevAnimating ? 'animate-[slide-reset_0.4s_ease-in-out]' : ''
                ]" />
            </button>

            <!-- Play/Pause Button -->
            <div class="relative flex items-center justify-center" style="--btn-size: 32px;">
                <!-- Ripple Rings -->
                <div v-if="isPlaying" class="absolute inset-0 flex items-center justify-center">
                    <div class="absolute w-16 h-16 rounded-full bg-linear-to-br from-violet-500/40 to-cyan-600/40 ripple-ring"
                        style="animation-delay: 0s;"></div>
                    <div class="absolute w-16 h-16 rounded-full bg-linear-to-br from-violet-500/30 to-cyan-600/30 ripple-ring"
                        style="animation-delay: 0.4s;"></div>
                    <div class="absolute w-16 h-16 rounded-full bg-linear-to-br from-violet-500/20 to-cyan-600/20 ripple-ring"
                        style="animation-delay: 0.8s;"></div>
                </div>

                <!-- Main Button - Fixed size, never changes -->
                <button @click="$emit('togglePlay')" :class="[
                    'w-16 h-16 rounded-full backdrop-blur-lg flex items-center justify-center transition-all relative play-pause-3d overflow-hidden',
                    isPlaying
                        ? 'bg-linear-to-br from-violet-600/80 to-violet-950/80 is-playing scale-95'
                        : 'bg-linear-to-br from-violet-600/90 to-cyan-700/90 active:scale-95 is-paused'
                ]">
                    <div class="play-pause-figure">
                        <div class="play-pause-bar"></div>
                        <div class="play-pause-bar"></div>
                    </div>
                </button>
            </div>

            <!-- Next Button -->
            <button @click="$emit('playNext')"
                class="w-12 h-12 rounded-full backdrop-blur-lg bg-white/5 flex items-center justify-center transition-all overflow-hidden shadow-[0.3rem_0.3rem_0.6rem_rgba(0,0,0,0.4),-0.2rem_-0.2rem_0.5rem_rgba(255,255,255,0.1)] active:shadow-[inset_0.2rem_0.2rem_0.5rem_rgba(0,0,0,0.6),inset_-0.2rem_-0.2rem_0.5rem_rgba(255,255,255,0.1)] active:scale-95">
                <UIcon name="i-solar-rewind-forward-bold-duotone" :class="[
                    'text-xl text-gray-300',
                    isPlaying && isNextAnimating ? 'animate-[slide-reset_0.4s_ease-in-out]' : ''
                ]" />
            </button>

            <!-- Repeat Button -->
            <button @click="$emit('toggleRepeat')"
                :class="[
                    'w-10 h-10 rounded-full backdrop-blur-lg bg-white/5 flex items-center justify-center transition-all relative duration-300',
                    repeatMode !== 'off'
                         ? 'shadow-[inset_0.2rem_0.2rem_0.5rem_rgba(0,0,0,0.6),inset_-0.2rem_-0.2rem_0.5rem_rgba(255,255,255,0.1)] text-violet-400' 
                        : 'shadow-[0.3rem_0.3rem_0.6rem_rgba(0,0,0,0.4),-0.2rem_-0.2rem_0.5rem_rgba(255,255,255,0.1)] active:shadow-[inset_0.2rem_0.2rem_0.5rem_rgba(0,0,0,0.6),inset_-0.2rem_-0.2rem_0.5rem_rgba(255,255,255,0.1)] text-gray-300'
                ]">
                <UIcon name="i-heroicons-arrow-path" :class="[
                    'text-lg transition-all duration-500',
                    repeatMode !== 'off' ? 'rotate-360' : ''
                ]" />
                <span v-if="repeatMode === 'one'"
                    class="absolute inset-0 flex items-center justify-center text-[10px] font-black pointer-events-none text-violet-400">1</span>
            </button>
        </div>
    </div>
</template>

<script setup lang="ts">
const props = defineProps<{
    currentSong: any;
    isPlaying: boolean;
    currentTime: number;
    duration: number;
    isShuffled: boolean;
    repeatMode: 'off' | 'all' | 'one';
    isNextAnimating: boolean;
    isPrevAnimating: boolean;
    compact?: boolean;
}>();

const emit = defineEmits<{
    togglePlay: [];
    playNext: [];
    playPrevious: [];
    toggleShuffle: [];
    toggleRepeat: [];
    seek: [time: number];
}>();

// Progress bar refs and state
const progressBarRef = ref<HTMLElement | null>(null);
const isDragging = ref(false);
const dragTime = ref(0);

// Cache rect during drag to avoid layout thrashing
let cachedRect: DOMRect | null = null;

// Computed progress percentage
const progressPercent = computed(() => {
    if (isDragging.value) {
        return (dragTime.value / (props.duration || 1)) * 100;
    }
    return (props.currentTime / (props.duration || 1)) * 100;
});

function formatTime(seconds: number): string {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
}

// Calculate time from position
function getTimeFromPosition(clientX: number): number {
    if (!cachedRect) return 0;
    const x = Math.max(0, Math.min(clientX - cachedRect.left, cachedRect.width));
    const percentage = x / cachedRect.width;
    return percentage * (props.duration || 0);
}

// Drag handlers
function startDrag(event: MouseEvent | TouchEvent) {
    if (!progressBarRef.value) return;
    
    // Cache the rect at drag start
    cachedRect = progressBarRef.value.getBoundingClientRect();
    isDragging.value = true;
    
    let clientX: number;
    if ('touches' in event && event.touches.length > 0) {
        clientX = event.touches[0]!.clientX;
    } else if ('clientX' in event) {
        clientX = event.clientX;
    } else {
        return;
    }
    
    dragTime.value = getTimeFromPosition(clientX);
    
    // Add global listeners
    document.addEventListener('mousemove', onDrag);
    document.addEventListener('mouseup', endDrag);
    document.addEventListener('touchmove', onDrag, { passive: false });
    document.addEventListener('touchend', endDrag);
}

function onDrag(event: MouseEvent | TouchEvent) {
    if (!isDragging.value) return;
    
    event.preventDefault();
    
    let clientX: number | undefined;
    
    if ('touches' in event && event.touches.length > 0) {
        clientX = event.touches[0]!.clientX;
    } else if ('clientX' in event) {
        clientX = event.clientX;
    }
    
    // Only update if we have a valid position
    if (clientX !== undefined) {
        dragTime.value = getTimeFromPosition(clientX);
    }
}

function endDrag() {
    if (isDragging.value) {
        emit('seek', dragTime.value);
        isDragging.value = false;
    }
    
    // Clear cached rect
    cachedRect = null;
    
    // Remove global listeners
    document.removeEventListener('mousemove', onDrag);
    document.removeEventListener('mouseup', endDrag);
    document.removeEventListener('touchmove', onDrag);
    document.removeEventListener('touchend', endDrag);
}

// Cleanup on unmount
onUnmounted(() => {
    document.removeEventListener('mousemove', onDrag);
    document.removeEventListener('mouseup', endDrag);
    document.removeEventListener('touchmove', onDrag);
    document.removeEventListener('touchend', endDrag);
});
</script>
