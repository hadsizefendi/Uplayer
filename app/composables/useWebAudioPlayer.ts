/**
 * Web Audio API based player
 * Completely bypasses HTMLAudioElement to avoid WebKitGTK VBR MP3 issues
 */
export function useWebAudioPlayer() {
    const audioContext = ref<AudioContext | null>(null)
    const audioBuffer = ref<AudioBuffer | null>(null)
    const sourceNode = ref<AudioBufferSourceNode | null>(null)
    const gainNode = ref<GainNode | null>(null)
    const analyserNode = ref<AnalyserNode | null>(null)
    
    const isPlaying = ref(false)
    const currentTime = ref(0)
    const duration = ref(0)
    const volume = ref(1)
    
    // Playback state
    let startTime = 0 // AudioContext time when playback started
    let pauseTime = 0 // Position in seconds when paused
    let timeUpdateInterval: ReturnType<typeof setInterval> | null = null
    
    // Callbacks
    let onEndedCallback: (() => void) | null = null
    let onTimeUpdateCallback: ((time: number) => void) | null = null
    
    /**
     * Initialize AudioContext (must be called after user interaction)
     */
    async function initContext() {
        if (audioContext.value) return audioContext.value
        
        audioContext.value = new (window.AudioContext || (window as any).webkitAudioContext)()
        
        // Create gain node for volume control
        gainNode.value = audioContext.value.createGain()
        gainNode.value.gain.value = volume.value
        gainNode.value.connect(audioContext.value.destination)
        
        // Create analyser node for visualization
        analyserNode.value = audioContext.value.createAnalyser()
        analyserNode.value.fftSize = 256
        analyserNode.value.smoothingTimeConstant = 0.8
        analyserNode.value.connect(gainNode.value)
        
        return audioContext.value
    }
    
    /**
     * Load and decode audio from ArrayBuffer
     */
    async function loadAudio(arrayBuffer: ArrayBuffer): Promise<boolean> {
        try {
            const ctx = await initContext()
            
            // Decode audio data
            audioBuffer.value = await ctx.decodeAudioData(arrayBuffer)
            
            duration.value = audioBuffer.value.duration
            currentTime.value = 0
            pauseTime = 0
            
            return true
        } catch (e) {
            console.error('[WebAudioPlayer] Failed to decode audio:', e)
            return false
        }
    }
    
    /**
     * Load audio from Blob URL
     */
    async function loadFromBlobUrl(blobUrl: string): Promise<boolean> {
        try {
            const response = await fetch(blobUrl)
            const arrayBuffer = await response.arrayBuffer()
            return await loadAudio(arrayBuffer)
        } catch (e) {
            console.error('[WebAudioPlayer] Failed to load from blob URL:', e)
            return false
        }
    }
    
    /**
     * Start or resume playback
     */
    function play() {
        if (!audioContext.value || !audioBuffer.value || !gainNode.value || !analyserNode.value) {
            return
        }
        
        if (isPlaying.value) return
        
        // Resume context if suspended
        if (audioContext.value.state === 'suspended') {
            audioContext.value.resume()
        }
        
        // Create new source node (they can only be used once)
        sourceNode.value = audioContext.value.createBufferSource()
        sourceNode.value.buffer = audioBuffer.value
        sourceNode.value.connect(analyserNode.value)
        
        // Handle ended event
        sourceNode.value.onended = () => {
            if (isPlaying.value) {
                // Check if we reached the end naturally
                const elapsed = audioContext.value!.currentTime - startTime + pauseTime
                if (elapsed >= duration.value - 0.1) {
                    stop()
                    onEndedCallback?.()
                }
            }
        }
        
        // Start playback from pauseTime
        startTime = audioContext.value.currentTime
        sourceNode.value.start(0, pauseTime)
        isPlaying.value = true
        
        // Start time update interval
        startTimeUpdate()
    }
    
    /**
     * Pause playback
     */
    function pause() {
        if (!isPlaying.value || !sourceNode.value || !audioContext.value) return
        
        // Calculate current position
        pauseTime = audioContext.value.currentTime - startTime + pauseTime
        
        // Stop the source
        try {
            sourceNode.value.stop()
            sourceNode.value.disconnect()
        } catch (e) {}
        
        sourceNode.value = null
        isPlaying.value = false
        
        // Stop time update
        stopTimeUpdate()
    }
    
    /**
     * Stop playback and reset position
     */
    function stop() {
        if (sourceNode.value) {
            try {
                sourceNode.value.stop()
                sourceNode.value.disconnect()
            } catch (e) {}
            sourceNode.value = null
        }
        
        isPlaying.value = false
        pauseTime = 0
        currentTime.value = 0
        
        stopTimeUpdate()
    }
    
    /**
     * Seek to a specific position
     */
    function seek(time: number) {
        const wasPlaying = isPlaying.value
        
        if (wasPlaying) {
            // Stop current playback
            if (sourceNode.value) {
                try {
                    sourceNode.value.stop()
                    sourceNode.value.disconnect()
                } catch (e) {}
                sourceNode.value = null
            }
            isPlaying.value = false
        }
        
        // Set new position
        pauseTime = Math.max(0, Math.min(time, duration.value))
        currentTime.value = pauseTime
        
        // Resume if was playing
        if (wasPlaying) {
            play()
        }
    }
    
    /**
     * Set volume (0-1)
     */
    function setVolume(vol: number) {
        volume.value = Math.max(0, Math.min(1, vol))
        if (gainNode.value) {
            gainNode.value.gain.value = volume.value
        }
    }
    
    /**
     * Get current volume
     */
    function getVolume(): number {
        return volume.value
    }
    
    /**
     * Start time update interval
     */
    function startTimeUpdate() {
        stopTimeUpdate()
        
        timeUpdateInterval = setInterval(() => {
            if (!isPlaying.value || !audioContext.value) return
            
            const elapsed = audioContext.value.currentTime - startTime + pauseTime
            currentTime.value = Math.min(elapsed, duration.value)
            
            onTimeUpdateCallback?.(currentTime.value)
        }, 100) // 10 updates per second
    }
    
    /**
     * Stop time update interval
     */
    function stopTimeUpdate() {
        if (timeUpdateInterval) {
            clearInterval(timeUpdateInterval)
            timeUpdateInterval = null
        }
    }
    
    /**
     * Set ended callback
     */
    function onEnded(callback: () => void) {
        onEndedCallback = callback
    }
    
    /**
     * Set time update callback
     */
    function onTimeUpdate(callback: (time: number) => void) {
        onTimeUpdateCallback = callback
    }
    
    /**
     * Get analyser node for visualization
     */
    function getAnalyser(): AnalyserNode | null {
        return analyserNode.value
    }
    
    /**
     * Get frequency data for visualization
     */
    function getFrequencyData(): Uint8Array | null {
        if (!analyserNode.value) return null
        
        const dataArray = new Uint8Array(analyserNode.value.frequencyBinCount)
        analyserNode.value.getByteFrequencyData(dataArray)
        return dataArray
    }
    
    /**
     * Cleanup
     */
    function destroy() {
        stop()
        
        if (gainNode.value) {
            gainNode.value.disconnect()
            gainNode.value = null
        }
        
        if (analyserNode.value) {
            analyserNode.value.disconnect()
            analyserNode.value = null
        }
        
        if (audioContext.value) {
            audioContext.value.close()
            audioContext.value = null
        }
        
        audioBuffer.value = null
    }
    
    return {
        // State
        isPlaying: readonly(isPlaying),
        currentTime: readonly(currentTime),
        duration: readonly(duration),
        volume: readonly(volume),
        
        // Methods
        initContext,
        loadAudio,
        loadFromBlobUrl,
        play,
        pause,
        stop,
        seek,
        setVolume,
        getVolume,
        
        // Events
        onEnded,
        onTimeUpdate,
        
        // Visualization
        getAnalyser,
        getFrequencyData,
        
        // Cleanup
        destroy
    }
}
