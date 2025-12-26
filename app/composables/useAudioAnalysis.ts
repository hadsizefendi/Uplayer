// Audio Analysis composable for frequency visualization
// Handles audio element recreation (key change) properly

export function useAudioAnalysis() {
    const audioContext = ref<AudioContext | null>(null);
    const analyser = ref<AnalyserNode | null>(null);
    const gainNode = ref<GainNode | null>(null);
    const dataArray = ref<Uint8Array | null>(null);
    const animationFrameId = ref<number | null>(null);
    const audioIntensity = ref(0);
    const isInitialized = ref(false);
    
    // Track connected element to detect element recreation
    let connectedElement: HTMLAudioElement | null = null;
    let sourceNode: MediaElementAudioSourceNode | null = null;
    
    // Store current volume for reapplication
    let currentVolume = 1;

    function initAudioContext(audioElement: HTMLAudioElement, forceReconnect = false) {
        if (!audioElement) return;
        
        // If same element and not forcing reconnect, skip
        if (connectedElement === audioElement && !forceReconnect) return;
        
        // If different element, we need to create new source
        const needsNewSource = connectedElement !== audioElement;

        try {
            // Create context once (shared across element recreations)
            if (!audioContext.value) {
                audioContext.value = new (window.AudioContext || (window as any).webkitAudioContext)();
            }
            
            // Create analyser once
            if (!analyser.value) {
                analyser.value = audioContext.value.createAnalyser();
                analyser.value.fftSize = 256;
                analyser.value.smoothingTimeConstant = 0.8;
                dataArray.value = new Uint8Array(analyser.value.frequencyBinCount);
            }
            
            // Create gain node once
            if (!gainNode.value) {
                gainNode.value = audioContext.value.createGain();
                gainNode.value.gain.value = currentVolume;
                analyser.value.connect(gainNode.value);
                gainNode.value.connect(audioContext.value.destination);
            }

            // Disconnect old source if element changed
            if (needsNewSource && sourceNode) {
                try { 
                    sourceNode.disconnect(); 
                } catch (e) {
                    // Ignore disconnect errors
                }
                sourceNode = null;
            }

            // Connect new audio element
            if (!sourceNode || needsNewSource) {
                sourceNode = audioContext.value.createMediaElementSource(audioElement);
                sourceNode.connect(analyser.value);
                connectedElement = audioElement;
            }
            
            isInitialized.value = true;
        } catch (error: any) {
            // InvalidStateError means element already has a source - try to reuse
            if (error.name === 'InvalidStateError') {
                connectedElement = audioElement;
                isInitialized.value = true;
            } else {
                console.error('Audio init error:', error);
            }
        }
    }

    // Resume context (call on user interaction)
    async function ensureContext(): Promise<void> {
        if (audioContext.value?.state === 'suspended') {
            await audioContext.value.resume();
        }
    }

    // Set volume directly (0-1)
    function setVolume(vol: number) {
        currentVolume = Math.max(0, Math.min(1, vol));
        if (gainNode.value) {
            gainNode.value.gain.value = currentVolume;
        }
    }

    function getVolume(): number {
        return gainNode.value?.gain.value ?? currentVolume;
    }

    function startAnalysis(
        audioElement: HTMLAudioElement,
        isPlaying: Ref<boolean>,
        onFrame: (data: Uint8Array, intensity: number) => void
    ) {
        // Check if audio element changed (key recreation)
        const elementChanged = connectedElement !== audioElement;
        
        // Initialize or reinitialize if element changed
        if (!isInitialized.value || elementChanged) {
            initAudioContext(audioElement, elementChanged);
        }
        
        // Resume context if suspended
        if (audioContext.value?.state === 'suspended') {
            audioContext.value.resume();
        }

        // Stop any existing animation
        if (animationFrameId.value) {
            cancelAnimationFrame(animationFrameId.value);
        }

        let lastTime = 0;
        const interval = 33; // ~30fps

        const analyze = (timestamp: number) => {
            if (!isPlaying.value || !analyser.value || !dataArray.value) {
                audioIntensity.value = 0;
                return;
            }
            
            // Throttle
            if (timestamp - lastTime < interval) {
                animationFrameId.value = requestAnimationFrame(analyze);
                return;
            }
            lastTime = timestamp;

            analyser.value.getByteFrequencyData(dataArray.value);
            
            // Calculate intensity
            let sum = 0;
            for (let i = 0; i < dataArray.value.length; i += 2) {
                sum += dataArray.value[i]!;
            }
            const avg = sum / (dataArray.value.length / 2);
            const normalized = avg / 255;
            
            // Smooth
            audioIntensity.value = audioIntensity.value * 0.7 + normalized * 0.3;
            
            onFrame(dataArray.value, audioIntensity.value);
            animationFrameId.value = requestAnimationFrame(analyze);
        };

        animationFrameId.value = requestAnimationFrame(analyze);
    }

    function stopAnalysis() {
        if (animationFrameId.value) {
            cancelAnimationFrame(animationFrameId.value);
            animationFrameId.value = null;
        }
        audioIntensity.value = 0;
    }

    // Reset connection tracking (call when audio element is destroyed)
    function resetConnection() {
        if (sourceNode) {
            try { sourceNode.disconnect(); } catch {}
            sourceNode = null;
        }
        connectedElement = null;
        isInitialized.value = false;
    }

    function cleanup() {
        stopAnalysis();
    }

    function destroy() {
        stopAnalysis();
        resetConnection();
        if (audioContext.value) {
            try { audioContext.value.close(); } catch {}
            audioContext.value = null;
        }
        analyser.value = null;
        gainNode.value = null;
    }

    return {
        audioIntensity,
        isInitialized,
        ensureContext,
        initAudioContext,
        startAnalysis,
        stopAnalysis,
        resetConnection,
        cleanup,
        destroy,
        setVolume,
        getVolume
    };
}
