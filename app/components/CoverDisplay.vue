<template>
    <div class="flex flex-col items-center px-6 pb-0 w-full" style="perspective: 1000px;">
        <!-- Preload previous and next covers (hidden) -->
        <div class="hidden">
            <img v-if="previousSong?.cover" :src="previousSong.cover" alt="" />
            <img v-if="nextSong?.cover" :src="nextSong.cover" alt="" />
        </div>

        <div v-if="currentSong" class="text-center w-full relative flex flex-col items-center">
            <!-- Cover Image -->
            <div ref="coverContainerRef" :class="[
                'mx-auto mb-2 rounded-2xl select-none touch-pan-y relative neon-frame shrink-0 transition-all duration-300 ease-out'
            ]" :style="{
                '--audio-intensity': audioIntensity,
                width: compact ? '4rem' : 'min(calc(100vw - 3rem), calc(100vh - 22rem))',
                height: compact ? '4rem' : 'min(calc(100vw - 3rem), calc(100vh - 22rem))'
            }" @touchstart="handleTouchStart" @touchmove="handleTouchMove" @touchend="handleTouchEnd">
                <!-- Neon Glow Effects -->
                <span class="shine shine-top"></span>
                <span class="shine shine-bottom"></span>
                <span class="glow glow-top"></span>
                <span class="glow glow-bottom"></span>
                <span class="glow glow-bright glow-top"></span>
                <span class="glow glow-bright glow-bottom"></span>

                <!-- Cover Image Container -->
                <div class="neon-inner overflow-hidden rounded-2xl shadow-2xl relative">
                    <USkeleton class="absolute inset-0" />
                    <img :src="currentSong.cover" :alt="currentSong.title" :class="[
                        'w-full h-full object-cover pointer-events-none relative transition-opacity duration-100',
                        isTransitioning ? 'opacity-0' : 'opacity-100'
                    ]" />
                </div>
            </div>

            <!-- Song Title & Artist -->
            <h2 :class="[
                'font-thin text-white mb-0.5 transition-all duration-500 shrink-0 truncate max-w-full',
                compact ? 'text-sm' : 'text-xl sm:text-2xl'
            ]">{{ currentSong.title }}</h2>
            <p :class="[
                'text-indigo-500 transition-all duration-500 font-black shrink-0',
                compact ? 'text-xs' : 'text-base sm:text-lg'
            ]">{{ currentSong.artist || 'Unknown Artist' }}</p>
        </div>

        <!-- No Song Selected State / Empty Library Drop Zone -->
        <div v-else class="text-center w-full relative flex flex-col items-center">
            <div class="mx-auto mb-2 rounded-2xl relative neon-frame shrink-0" :style="{
                '--audio-intensity': 0,
                width: 'min(calc(100vw - 3rem), calc(100vh - 22rem))',
                height: 'min(calc(100vw - 3rem), calc(100vh - 22rem))'
            }">
                <!-- Neon Glow Effects -->
                <span class="shine shine-top"></span>
                <span class="shine shine-bottom"></span>
                <span class="glow glow-top"></span>
                <span class="glow glow-bottom"></span>
                <span class="glow glow-bright glow-top"></span>
                <span class="glow glow-bright glow-bottom"></span>

                <!-- Cover Image Container / Drop Zone -->
                <div class="neon-inner overflow-hidden rounded-2xl shadow-2xl relative">
                    <!-- Show drop zone if no songs in library -->
                    <template v-if="!hasSongs">
                        <!-- Tauri mode: Simple drop zone (drag-drop handled by Tauri API) -->
                        <div v-if="isTauri"
                            class="w-full h-full flex flex-col items-center justify-center bg-black/30 border-2 border-dashed border-white/10 rounded-2xl p-4">
                            <Vue3Lottie animationLink="/animations/open.json" :height="80" :width="80" :loop="true" />
                            <p class="text-white/80 text-lg font-semibold mt-2">Drop your music</p>
                            <p class="text-white/40 text-sm">or click to select</p>
                            <UButton @click="emit('browseFiles')" size="sm" color="primary" variant="soft" class="mt-3">
                                <UIcon name="i-heroicons-folder-open" class="mr-1" />
                                Browse Files
                            </UButton>
                        </div>
                        <!-- Web mode: UFileUpload with drag-drop -->
                        <UFileUpload v-else @update:model-value="handleFilesSelected" accept="audio/*" multiple
                            :preview="false" :interactive="false" label="Drop your music"
                            description="or click to select" class="w-full h-full min-h-0" :ui="{
                                base: 'bg-black/30 border-white/10 hover:bg-black/40 h-full rounded-2xl',
                                label: 'text-white/80 text-lg font-semibold',
                                description: 'text-white/40 text-sm'
                            }">
                            <template #leading>
                                <Vue3Lottie animationLink="/animations/open.json" :height="80" :width="80"
                                    :loop="true" />
                            </template>
                            <template #actions="{ open }">
                                <UButton @click="open()" size="sm" color="primary" variant="soft" class="mt-2">
                                    <UIcon name="i-heroicons-folder-open" class="mr-1" />
                                    Browse Files
                                </UButton>
                            </template>
                        </UFileUpload>
                    </template>
                    <!-- Show logo when songs exist but none selected -->
                    <template v-else>
                        <USkeleton class="absolute inset-0" />
                        <img src="/default.webp" alt="Uplayer" class="w-full h-full object-cover relative" />
                    </template>
                </div>
            </div>
            <h2 class="font-thin text-white mb-0.5 text-xl sm:text-2xl shrink-0">{{ hasSongs ? 'Uplayer' : 'Welcome to Uplayer' }}
            </h2>
            <p class="text-indigo-500 text-base sm:text-lg font-black shrink-0">{{ hasSongs ? 'Music Player' : 'Add some music to get started' }}</p>
        </div>
    </div>
</template>

<script setup lang="ts">
import { Vue3Lottie } from 'vue3-lottie'

// Check if running in Tauri
const isTauri = computed(() => typeof window !== 'undefined' && '__TAURI__' in window)

const props = defineProps<{
    currentSong: any;
    audioIntensity: number;
    compact: boolean;
    previousSong: any;
    nextSong: any;
    hasSongs: boolean;
}>();

const emit = defineEmits<{
    swipeNext: [];
    swipePrevious: [];
    filesSelected: [files: File | File[] | null | undefined];
    browseFiles: []; // For Tauri mode - trigger native dialog
}>();

// Handle file selection from UFileUpload (web mode only)
function handleFilesSelected(value: File | File[] | null | undefined) {
    // In Tauri mode, UFileUpload's file selection doesn't work properly
    // because web File objects don't have full paths
    // So we ignore this event in Tauri mode
    if (isTauri.value) return;
    emit('filesSelected', value);
}

// Cover container ref for 3D swipe
const coverContainerRef = ref<HTMLElement | null>(null);

// Touch handling
const touchStartX = ref(0);
const touchEndX = ref(0);
const touchCurrentX = ref(0);
let rafPending = false;

// Cover transition state - hide image during swipe transition
const isTransitioning = ref(false);

function handleTouchStart(event: TouchEvent) {
    const touch = event.touches[0];
    if (!touch) return;
    touchStartX.value = touch.clientX;
    touchCurrentX.value = touchStartX.value;

    if (coverContainerRef.value) {
        coverContainerRef.value.style.willChange = 'transform';
        coverContainerRef.value.classList.add('swiping');
    }
}

function handleTouchMove(event: TouchEvent) {
    if (!coverContainerRef.value) return;

    const touch = event.touches[0];
    if (!touch) return;
    touchCurrentX.value = touch.clientX;

    if (rafPending) return;
    rafPending = true;

    requestAnimationFrame(() => {
        rafPending = false;
        if (!coverContainerRef.value) return;

        const deltaX = touchCurrentX.value - touchStartX.value;
        const maxDelta = 120;
        const clampedDelta = Math.max(-maxDelta, Math.min(maxDelta, deltaX));

        coverContainerRef.value.style.transform = `translate3d(${clampedDelta}px, 0, 0)`;
    });
}

function handleTouchEnd(event: TouchEvent) {
    const touch = event.changedTouches[0];
    if (!touch) return;
    touchEndX.value = touch.clientX;
    handleSwipe();
}

function handleSwipe() {
    const swipeDistance = touchEndX.value - touchStartX.value;
    const minSwipeDistance = 50;

    if (Math.abs(swipeDistance) > minSwipeDistance) {
        const direction = swipeDistance > 0 ? 1 : -1;

        if (coverContainerRef.value) {
            coverContainerRef.value.style.transition = 'transform 0.15s ease-out';
            coverContainerRef.value.style.transform = `translate3d(${direction * 400}px, 0, 0)`;

            // Hide cover before it moves out
            isTransitioning.value = true;

            setTimeout(() => {
                if (direction > 0) {
                    emit('swipePrevious');
                } else {
                    emit('swipeNext');
                }

                // Wait for Vue to render the new cover
                nextTick(() => {
                    if (coverContainerRef.value) {
                        coverContainerRef.value.style.transition = 'none';
                        coverContainerRef.value.style.transform = `translate3d(${direction * -400}px, 0, 0)`;

                        void coverContainerRef.value.offsetWidth;

                        // New cover loaded, show it
                        isTransitioning.value = false;

                        coverContainerRef.value.style.transition = 'transform 0.25s ease-out';
                        coverContainerRef.value.style.transform = 'translate3d(0, 0, 0)';

                        setTimeout(() => {
                            if (coverContainerRef.value) {
                                coverContainerRef.value.style.transition = '';
                                coverContainerRef.value.style.transform = '';
                                coverContainerRef.value.style.willChange = '';
                                coverContainerRef.value.classList.remove('swiping');
                            }
                        }, 250);
                    }
                });
            }, 150);
        } else {
            if (swipeDistance > 0) {
                emit('swipePrevious');
            } else {
                emit('swipeNext');
            }
        }
    } else {
        if (coverContainerRef.value) {
            coverContainerRef.value.style.transition = 'transform 0.2s ease-out';
            coverContainerRef.value.style.transform = 'translate3d(0, 0, 0)';

            setTimeout(() => {
                if (coverContainerRef.value) {
                    coverContainerRef.value.style.transition = '';
                    coverContainerRef.value.style.transform = '';
                    coverContainerRef.value.style.willChange = '';
                    coverContainerRef.value.classList.remove('swiping');
                }
            }, 200);
        }
    }
}

// Expose cover container ref for parent component
defineExpose({
    coverContainerRef
});
</script>
