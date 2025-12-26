export interface PlayerSettings {
    keepScreenOn: boolean;
    showLyrics: boolean;
    largeLyrics: boolean;
    soundEnabled: boolean;
    waveEnabled: boolean;
    waveType: 'equalizer' | 'uniquewave';
}

const STORAGE_KEYS = {
    VOLUME: 'uplayer_volume',
    SHUFFLE: 'uplayer_shuffle',
    REPEAT: 'uplayer_repeat',
    LAST_SONG_ID: 'uplayer_last_song_id',
    LAST_TIME: 'uplayer_last_time',
    APP_SETTINGS: 'uplayer_app_settings'
};

/**
 * Player Settings - localStorage ile kalıcı ayarlar
 */
export function usePlayerSettings() {
    // Player state
    const volume = ref(100);
    const isShuffled = ref(false);
    const repeatMode = ref<'off' | 'all' | 'one'>('all');
    const lastSongId = ref<string | null>(null);
    const lastTime = ref<number>(0);

    // App settings
    const settings = reactive<PlayerSettings>({
        keepScreenOn: true,
        showLyrics: true,
        largeLyrics: false,
        soundEnabled: true,
        waveEnabled: true,
        waveType: 'uniquewave'
    });

    // Player state'i yükle
    function loadPlayerState() {
        if (typeof window === 'undefined') return;

        const savedVolume = localStorage.getItem(STORAGE_KEYS.VOLUME);
        if (savedVolume) volume.value = parseInt(savedVolume);

        const savedShuffle = localStorage.getItem(STORAGE_KEYS.SHUFFLE);
        if (savedShuffle) isShuffled.value = savedShuffle === 'true';

        const savedRepeat = localStorage.getItem(STORAGE_KEYS.REPEAT);
        if (savedRepeat) repeatMode.value = savedRepeat as 'off' | 'all' | 'one';

        lastSongId.value = localStorage.getItem(STORAGE_KEYS.LAST_SONG_ID);
        
        const savedTime = localStorage.getItem(STORAGE_KEYS.LAST_TIME);
        if (savedTime) lastTime.value = parseFloat(savedTime);
    }

    // Player state'i kaydet
    function savePlayerState(currentSongId?: string | number, currentTime?: number) {
        if (typeof window === 'undefined') return;

        localStorage.setItem(STORAGE_KEYS.VOLUME, volume.value.toString());
        localStorage.setItem(STORAGE_KEYS.SHUFFLE, isShuffled.value.toString());
        localStorage.setItem(STORAGE_KEYS.REPEAT, repeatMode.value);

        if (currentSongId !== undefined) {
            localStorage.setItem(STORAGE_KEYS.LAST_SONG_ID, currentSongId.toString());
        }
        if (currentTime !== undefined && currentTime > 0) {
            localStorage.setItem(STORAGE_KEYS.LAST_TIME, currentTime.toString());
        }
    }

    // App settings'i yükle
    function loadAppSettings() {
        if (typeof window === 'undefined') return;

        const savedSettings = localStorage.getItem(STORAGE_KEYS.APP_SETTINGS);
        if (savedSettings) {
            try {
                const parsed = JSON.parse(savedSettings);
                Object.assign(settings, parsed);
            } catch (e) {
                console.error('Failed to parse app settings:', e);
            }
        }
    }

    // App settings'i kaydet
    function saveAppSettings() {
        if (typeof window === 'undefined') return;
        localStorage.setItem(STORAGE_KEYS.APP_SETTINGS, JSON.stringify(settings));
    }

    // Tümünü yükle
    function loadAll() {
        loadPlayerState();
        loadAppSettings();
    }

    // Setting değiştir ve kaydet
    function toggleSetting(key: keyof PlayerSettings) {
        if (typeof settings[key] === 'boolean') {
            (settings[key] as boolean) = !settings[key];
            saveAppSettings();
        }
    }

    // Wave type değiştir
    function setWaveType(type: 'equalizer' | 'uniquewave') {
        settings.waveType = type;
        saveAppSettings();
    }

    // Volume watcher'ı oluştur
    function watchVolume(callback?: (newVolume: number) => void) {
        watch(volume, (newVolume) => {
            savePlayerState();
            callback?.(newVolume);
        });
    }

    // Shuffle watcher
    function watchShuffle(callback?: (newValue: boolean) => void) {
        watch(isShuffled, (newValue) => {
            savePlayerState();
            callback?.(newValue);
        });
    }

    // Repeat mode watcher
    function watchRepeatMode(callback?: (newValue: 'off' | 'all' | 'one') => void) {
        watch(repeatMode, (newValue) => {
            savePlayerState();
            callback?.(newValue);
        });
    }

    return {
        // Player state
        volume,
        isShuffled,
        repeatMode,
        lastSongId: readonly(lastSongId),
        lastTime: readonly(lastTime),

        // App settings
        settings,

        // Methods
        loadPlayerState,
        savePlayerState,
        loadAppSettings,
        saveAppSettings,
        loadAll,
        toggleSetting,
        setWaveType,
        watchVolume,
        watchShuffle,
        watchRepeatMode,

        // Constants
        STORAGE_KEYS
    };
}
