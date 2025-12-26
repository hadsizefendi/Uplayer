/**
 * Media Session API - Bildirim kontrolleri
 */
export function useMediaSession() {
    const isSupported = ref(false);

    onMounted(() => {
        isSupported.value = 'mediaSession' in navigator;
    });

    function setup(options: {
        onPlay: () => void;
        onPause: () => void;
        onPrevious: () => void;
        onNext: () => void;
        onSeekBackward?: (offset: number) => void;
        onSeekForward?: (offset: number) => void;
        onSeekTo?: (time: number) => void;
        onStop?: () => void;
    }) {
        if (!('mediaSession' in navigator)) return;

        navigator.mediaSession.setActionHandler('play', options.onPlay);
        navigator.mediaSession.setActionHandler('pause', options.onPause);
        navigator.mediaSession.setActionHandler('previoustrack', options.onPrevious);
        navigator.mediaSession.setActionHandler('nexttrack', options.onNext);

        if (options.onSeekBackward) {
            navigator.mediaSession.setActionHandler('seekbackward', (details) => {
                const skipTime = details.seekOffset || 10;
                options.onSeekBackward!(skipTime);
            });
        }

        if (options.onSeekForward) {
            navigator.mediaSession.setActionHandler('seekforward', (details) => {
                const skipTime = details.seekOffset || 10;
                options.onSeekForward!(skipTime);
            });
        }

        if (options.onSeekTo) {
            navigator.mediaSession.setActionHandler('seekto', (details) => {
                if (details.seekTime !== undefined) {
                    options.onSeekTo!(details.seekTime);
                }
            });
        }

        if (options.onStop) {
            navigator.mediaSession.setActionHandler('stop', options.onStop);
        }
    }

    function updateMetadata(song: { title: string; cover: string | null; artist?: string; album?: string }) {
        if (!('mediaSession' in navigator) || !song) return;

        try {
            // Handle cover URL - may be null, blob:, data:, http://, https://, or relative path
            let artwork: MediaImage[] = [];
            
            if (song.cover) {
                let coverUrl = song.cover;
                if (song.cover.startsWith('blob:') || song.cover.startsWith('data:') || 
                    song.cover.startsWith('http://') || song.cover.startsWith('https://')) {
                    coverUrl = song.cover;
                } else if (song.cover.startsWith('/')) {
                    coverUrl = window.location.origin + song.cover;
                } else {
                    coverUrl = window.location.origin + '/' + song.cover;
                }
                
                artwork = [
                    { src: coverUrl, sizes: '96x96', type: 'image/webp' },
                    { src: coverUrl, sizes: '128x128', type: 'image/webp' },
                    { src: coverUrl, sizes: '192x192', type: 'image/webp' },
                    { src: coverUrl, sizes: '256x256', type: 'image/webp' },
                    { src: coverUrl, sizes: '384x384', type: 'image/webp' },
                    { src: coverUrl, sizes: '512x512', type: 'image/webp' }
                ];
            }

            navigator.mediaSession.metadata = new MediaMetadata({
                title: song.title || 'Unknown',
                artist: song.artist || 'Unknown Artist',
                album: song.album || 'Uplayer',
                artwork
            });
        } catch (e) {
            console.warn('Failed to update media session metadata:', e);
        }
    }

    function updatePlaybackState(state: 'playing' | 'paused' | 'none') {
        if (!('mediaSession' in navigator)) return;
        navigator.mediaSession.playbackState = state;
    }

    function updatePositionState(duration: number, currentTime: number, playbackRate: number = 1) {
        if (!('mediaSession' in navigator)) return;

        if (duration > 0 && isFinite(duration)) {
            try {
                navigator.mediaSession.setPositionState({
                    duration,
                    playbackRate,
                    position: Math.min(currentTime, duration)
                });
            } catch (error) {
                console.debug('Media Session position state error:', error);
            }
        }
    }

    function clearPositionState() {
        if (!('mediaSession' in navigator)) return;
        
        try {
            navigator.mediaSession.setPositionState(undefined);
        } catch (e) {
            // Ignore
        }
    }

    return {
        isSupported: readonly(isSupported),
        setup,
        updateMetadata,
        updatePlaybackState,
        updatePositionState,
        clearPositionState
    };
}
