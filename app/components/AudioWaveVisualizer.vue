<template>
    <div v-show="!playlistExpanded && waveEnabled" ref="waveWrapperRef" class="wave-container-wrapper">
        <!-- Modern Equalizer (SVG) -->
        <div v-show="waveType === 'equalizer'" class="wave-container">
            <svg ref="waveSvgRef" class="wave-svg equalizer-svg" :viewBox="`0 0 ${svgWidth} 100`" preserveAspectRatio="none">
                <defs>
                    <!-- Modern gradient with purple to cyan -->
                    <linearGradient id="barGradient" x1="0" y1="100" x2="0" y2="0" gradientUnits="userSpaceOnUse">
                        <stop offset="0%" stop-color="#7C3AED" stop-opacity="0.9"/>
                        <stop offset="30%" stop-color="#8B5CF6" stop-opacity="1"/>
                        <stop offset="60%" stop-color="#A78BFA" stop-opacity="1"/>
                        <stop offset="100%" stop-color="#C4B5FD" stop-opacity="0.8"/>
                    </linearGradient>
                    <!-- Accent gradient for highlights -->
                    <linearGradient id="accentGradient" x1="0" y1="100" x2="0" y2="0" gradientUnits="userSpaceOnUse">
                        <stop offset="0%" stop-color="#06B6D4" stop-opacity="0.8"/>
                        <stop offset="50%" stop-color="#22D3EE" stop-opacity="1"/>
                        <stop offset="100%" stop-color="#67E8F9" stop-opacity="0.6"/>
                    </linearGradient>
                    <!-- Soft glow filter -->
                    <filter id="softGlow" x="-30%" y="-30%" width="160%" height="160%">
                        <feGaussianBlur stdDeviation="1.5" result="blur"/>
                        <feMerge>
                            <feMergeNode in="blur"/>
                            <feMergeNode in="SourceGraphic"/>
                        </feMerge>
                    </filter>
                </defs>
                
                <!-- Main bars group - dynamic count -->
                <g ref="waveGroupRef" filter="url(#softGlow)">
                    <rect v-for="(bar, i) in barCount" :key="'main-'+i"
                        :x="getBarX(i)" :y="getBarY(i)" :width="barWidth" :height="getBarHeight(i)"
                        :rx="barWidth/2" fill="url(#barGradient)"/>
                </g>
                
                <!-- Accent highlight bars (cyan overlay) -->
                <g ref="accentGroupRef" opacity="0.4">
                    <rect v-for="(bar, i) in barCount" :key="'accent-'+i"
                        :x="getBarX(i)" :y="getBarY(i)" :width="barWidth" :height="getBarHeight(i)"
                        :rx="barWidth/2" fill="url(#accentGradient)"/>
                </g>
            </svg>
        </div>
        
        <!-- uniquewave (Canvas) -->
        <div v-show="waveType === 'uniquewave'" ref="uniquewaveContainerRef" class="uniquewave-container"></div>
    </div>
</template>

<script setup lang="ts">
import { uniquewave } from '~/composables/useAudioVisualizer';

const props = defineProps<{
    playlistExpanded: boolean;
    waveEnabled: boolean;
    waveType: 'equalizer' | 'uniquewave';
    isPlaying: boolean;
    coverContainerRef: HTMLElement | null;
}>();

// Refs
const waveWrapperRef = ref<HTMLElement | null>(null);
const waveSvgRef = ref<SVGSVGElement | null>(null);
const waveGroupRef = ref<SVGGElement | null>(null);
const accentGroupRef = ref<SVGGElement | null>(null);
const uniquewaveContainerRef = ref<HTMLElement | null>(null);

// State
const waveBars = ref<SVGRectElement[]>([]);
const accentBars = ref<SVGRectElement[]>([]);
const waveBarValues = ref<number[]>([]);
const isWaveIdle = ref(true);
const idleAnimationId = ref<number | null>(null);
const uniquewaveInstance = ref<any>(null);
const isDesktop = ref(false);

// Smooth fade for soft transitions
let currentFade = 0.3;
let targetFade = 0.3;
const fadeSpeed = 0.02;

// Dynamic bar count - 25 on mobile, 50 on desktop
const barCount = computed(() => isDesktop.value ? 50 : 25);
const barWidth = computed(() => isDesktop.value ? 3 : 4);
const barSpacing = computed(() => isDesktop.value ? 8 : 8);
const svgWidth = computed(() => barCount.value * barSpacing.value);

// Calculate bar position and height based on index
function getBarX(i: number): number {
    return i * barSpacing.value + 2;
}

function getBarHeight(i: number): number {
    const count = barCount.value;
    const center = count / 2;
    const distance = Math.abs(i - center) / center;
    // Parabolic curve for height - max 90 at center, min 10 at edges
    return 10 + (1 - distance * distance) * 80;
}

function getBarY(i: number): number {
    return 50 - getBarHeight(i) / 2;
}

// Generate base heights array dynamically
function getBaseHeights(): number[] {
    const heights: number[] = [];
    for (let i = 0; i < barCount.value; i++) {
        heights.push(getBarHeight(i));
    }
    return heights;
}

// Check if desktop on mount and resize
function checkDesktop() {
    isDesktop.value = window.innerWidth >= 768;
}

// Initialize uniquewave
function inituniquewave() {
    if (!uniquewaveContainerRef.value) return;
    
    destroyuniquewave();
    
    const containerWidth = uniquewaveContainerRef.value.clientWidth || window.innerWidth;
    
    uniquewaveInstance.value = new uniquewave({
        width: containerWidth,
        height: 100,
        color: '#a855f7',
        container: uniquewaveContainerRef.value,
        autostart: true,
        amplitude: 0
    });
    
    uniquewaveInstance.value.setSpeed(0.02);
    uniquewaveInstance.value.setAmplitude(props.isPlaying ? 0.6 : 0);
}

function destroyuniquewave() {
    if (uniquewaveInstance.value) {
        uniquewaveInstance.value.destroy();
        uniquewaveInstance.value = null;
    }
}

function updateuniquewaveAmplitude(intensity: number, frequencyData?: Uint8Array) {
    if (uniquewaveInstance.value && props.waveType === 'uniquewave') {
        uniquewaveInstance.value.setAmplitude(intensity * 1.0);
        
        // If we have frequency data, extract bands for more realistic visualization
        if (frequencyData && frequencyData.length > 0) {
            const len = frequencyData.length;
            
            // Low frequencies (bass) - first 1/6 of spectrum
            let lowSum = 0;
            const lowEnd = Math.floor(len / 6);
            for (let i = 0; i < lowEnd; i++) {
                lowSum += frequencyData[i] || 0;
            }
            const low = (lowSum / lowEnd) / 255;
            
            // Mid frequencies - middle 2/6 of spectrum
            let midSum = 0;
            const midStart = lowEnd;
            const midEnd = Math.floor(len / 2);
            for (let i = midStart; i < midEnd; i++) {
                midSum += frequencyData[i] || 0;
            }
            const mid = (midSum / (midEnd - midStart)) / 255;
            
            // High frequencies (treble) - last half of spectrum
            let highSum = 0;
            for (let i = midEnd; i < len; i++) {
                highSum += frequencyData[i] || 0;
            }
            const high = (highSum / (len - midEnd)) / 255;
            
            uniquewaveInstance.value.setFrequencyBands(low, mid, high);
        }
    }
}

// Wave position
function updateWavePosition() {
    if (!waveWrapperRef.value || !props.coverContainerRef) return;
    
    const coverRect = props.coverContainerRef.getBoundingClientRect();
    const coverTop = coverRect.top;
    waveWrapperRef.value.style.height = `${coverTop}px`;
}

// Equalizer animation - using rects
function initWaveAnimation() {
    if (!waveGroupRef.value) return;
    
    const bars = Array.from(waveGroupRef.value.querySelectorAll('rect'));
    if (!bars.length) return;
    
    waveBars.value = bars as SVGRectElement[];
    waveBarValues.value = new Array(bars.length).fill(0.05);
    
    // Initialize accent bars
    if (accentGroupRef.value) {
        accentBars.value = Array.from(accentGroupRef.value.querySelectorAll('rect')) as SVGRectElement[];
    }
    
    const heights = getBaseHeights();
    
    // Set initial state
    bars.forEach((bar, i) => {
        const minHeight = heights[i] ?? 10;
        bar.setAttribute('height', (minHeight * 0.1).toString());
        bar.setAttribute('y', (50 - (minHeight * 0.1) / 2).toString());
        bar.style.opacity = '0.4';
        bar.style.transition = 'none';
    });
    
    accentBars.value.forEach((bar, i) => {
        const minHeight = heights[i] ?? 10;
        bar.setAttribute('height', (minHeight * 0.1).toString());
        bar.setAttribute('y', (50 - (minHeight * 0.1) / 2).toString());
    });
    
    isWaveIdle.value = true;
    startIdleWaveAnimation();
}

function startIdleWaveAnimation() {
    if (idleAnimationId.value) return;
    
    let phase = 0;
    const decaySpeed = 0.03; // How fast bars decay to idle state
    
    const animateIdle = () => {
        if (!isWaveIdle.value) {
            idleAnimationId.value = null;
            return;
        }
        
        // Smooth fade transition
        if (currentFade < targetFade) {
            currentFade = Math.min(currentFade + fadeSpeed, targetFade);
        } else if (currentFade > targetFade) {
            currentFade = Math.max(currentFade - fadeSpeed, targetFade);
        }
        
        phase += 0.02;
        const heights = getBaseHeights();
        
        waveBars.value.forEach((bar, i) => {
            const centerIndex = waveBars.value.length / 2;
            const distanceFromCenter = Math.abs(i - centerIndex) / centerIndex;
            
            // Target idle value with gentle wave
            const idleTarget = 0.1 + Math.sin(phase - distanceFromCenter * 3) * 0.15 + 0.15;
            
            // Smoothly decay current value toward idle target
            const currentValue = waveBarValues.value[i] || 0.1;
            const newValue = currentValue + (idleTarget - currentValue) * decaySpeed;
            waveBarValues.value[i] = newValue;
            
            const clampedValue = Math.max(0.1, Math.min(0.4, newValue)) * currentFade;
            
            const maxHeight = heights[i] ?? 50;
            const currentHeight = maxHeight * clampedValue;
            const currentY = 50 - currentHeight / 2;
            
            bar.setAttribute('height', currentHeight.toString());
            bar.setAttribute('y', currentY.toString());
            bar.style.opacity = `${(0.4 + clampedValue * 0.6) * currentFade}`;
        });
        
        // Update accent bars with same decayed values
        accentBars.value.forEach((bar, i) => {
            const clampedValue = Math.max(0.1, Math.min(0.4, waveBarValues.value[i] || 0.1)) * currentFade;
            
            const maxHeight = heights[i] ?? 50;
            const currentHeight = maxHeight * clampedValue;
            const currentY = 50 - currentHeight / 2;
            
            bar.setAttribute('height', currentHeight.toString());
            bar.setAttribute('y', currentY.toString());
            bar.style.opacity = `${currentFade * 0.4}`;
        });
        
        idleAnimationId.value = requestAnimationFrame(animateIdle);
    };
    
    animateIdle();
}

function stopIdleWaveAnimation() {
    if (idleAnimationId.value) {
        cancelAnimationFrame(idleAnimationId.value);
        idleAnimationId.value = null;
    }
}

function updateWaveEqualizer(frequencyData: Uint8Array) {
    if (!waveBars.value.length || !frequencyData) return;
    
    // Smooth fade transition
    if (currentFade < targetFade) {
        currentFade = Math.min(currentFade + fadeSpeed, targetFade);
    } else if (currentFade > targetFade) {
        currentFade = Math.max(currentFade - fadeSpeed, targetFade);
    }
    
    const count = waveBars.value.length;
    const dataLength = frequencyData.length;
    const centerIndex = Math.floor(count / 2);
    const heights = getBaseHeights();
    
    waveBars.value.forEach((bar, i) => {
        const distanceFromCenter = Math.abs(i - centerIndex) / centerIndex;
        const freqIndex = Math.floor(distanceFromCenter * dataLength * 0.6);
        
        const rawValue = frequencyData[freqIndex] || 0;
        const normalizedValue = rawValue / 255;
        
        const prevValue = waveBarValues.value[i] || 0.1;
        const smoothedValue = prevValue * 0.65 + normalizedValue * 0.35;
        waveBarValues.value[i] = smoothedValue;
        
        const scaleValue = (0.1 + smoothedValue * 0.9) * currentFade;
        const opacityValue = (0.5 + smoothedValue * 0.5) * currentFade;
        
        const maxHeight = heights[i] ?? 50;
        const currentHeight = maxHeight * scaleValue;
        const currentY = 50 - currentHeight / 2;
        
        bar.setAttribute('height', currentHeight.toString());
        bar.setAttribute('y', currentY.toString());
        bar.style.opacity = `${opacityValue}`;
    });
    
    // Update accent bars
    accentBars.value.forEach((bar, i) => {
        const scaleValue = (0.1 + (waveBarValues.value[i] || 0.1) * 0.9) * currentFade;
        const maxHeight = heights[i] ?? 50;
        const currentHeight = maxHeight * scaleValue;
        const currentY = 50 - currentHeight / 2;
        
        bar.setAttribute('height', currentHeight.toString());
        bar.setAttribute('y', currentY.toString());
        bar.style.opacity = `${currentFade * 0.4}`;
    });
}

function stopWaveEqualizer() {
    // Don't reset values immediately - let them decay smoothly in idle animation
    isWaveIdle.value = true;
    startIdleWaveAnimation();
}

function stopWaveAnimation() {
    isWaveIdle.value = false;
    stopIdleWaveAnimation();
}

function setWaveIdle(idle: boolean) {
    isWaveIdle.value = idle;
}

function setFadeTarget(playing: boolean) {
    targetFade = playing ? 1 : 0.3;
}

function initWave() {
    if (props.waveType === 'equalizer') {
        if (waveGroupRef.value && !waveBars.value.length) {
            initWaveAnimation();
        }
    } else if (props.waveType === 'uniquewave') {
        inituniquewave();
    }
}

// Watch isPlaying for smooth fade
watch(() => props.isPlaying, (playing) => {
    targetFade = playing ? 1 : 0.3;
}, { immediate: true });

// Watch for bar count changes (desktop/mobile switch)
watch(barCount, () => {
    nextTick(() => {
        waveBars.value = [];
        accentBars.value = [];
        if (props.waveType === 'equalizer') {
            initWaveAnimation();
        }
    });
});

// Expose methods for parent
defineExpose({
    initWave,
    inituniquewave,
    destroyuniquewave,
    updateuniquewaveAmplitude,
    updateWavePosition,
    initWaveAnimation,
    startIdleWaveAnimation,
    stopIdleWaveAnimation,
    updateWaveEqualizer,
    stopWaveEqualizer,
    stopWaveAnimation,
    setWaveIdle,
    setFadeTarget,
    waveLines: waveBars
});

// Lifecycle
onMounted(() => {
    checkDesktop();
    
    nextTick(() => {
        initWave();
        updateWavePosition();
    });
    
    window.addEventListener('resize', () => {
        checkDesktop();
        updateWavePosition();
        if (props.waveType === 'uniquewave' && uniquewaveInstance.value) {
            destroyuniquewave();
            inituniquewave();
        }
    });
});

onUnmounted(() => {
    stopWaveAnimation();
    destroyuniquewave();
});
</script>
