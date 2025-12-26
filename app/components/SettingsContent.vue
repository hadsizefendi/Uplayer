<template>
    <div>
        <WindowTitlebar class="opacity-0" />
        <!-- Volume -->
        <div class="p-4 flex items-center justify-between cursor-pointer hover:bg-white/5 transition-colors"
            @click="emit('toggle', 'soundEnabled')">
            <div class="flex items-center gap-3">
                <div class="w-10 h-10 rounded-full bg-emerald-500/20 flex items-center justify-center">
                    <UIcon :name="settings.soundEnabled ? 'i-heroicons-speaker-wave' : 'i-heroicons-speaker-x-mark'"
                        :class="['text-lg', settings.soundEnabled ? 'text-emerald-400' : 'text-red-400']" />
                </div>
                <div>
                    <p class="text-white font-medium">Sound</p>
                    <p class="text-gray-400 text-xs">Toggle player audio on/off</p>
                </div>
            </div>
            <SettingsToggle :active="settings.soundEnabled" patternId="toggle-pattern-1"
                @click="emit('toggle', 'soundEnabled')" />
        </div>

        <!-- Volume Slider -->
        <div class="px-4 pb-4" v-if="settings.soundEnabled">
            <div class="flex items-center gap-3">
                <UIcon name="i-heroicons-speaker-x-mark" class="text-gray-500 text-sm shrink-0" />
                <input :value="volume" type="range" min="0" max="100"
                    @input="emit('update:volume', Number(($event.target as HTMLInputElement).value))" @touchstart.stop
                    @touchmove.stop @touchend.stop
                    class="flex-1 h-3 bg-white/10 rounded-full appearance-none cursor-pointer touch-pan-x [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-7 [&::-webkit-slider-thumb]:h-7 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-white [&::-webkit-slider-thumb]:shadow-lg [&::-webkit-slider-thumb]:border-2 [&::-webkit-slider-thumb]:border-emerald-400 [&::-moz-range-thumb]:w-7 [&::-moz-range-thumb]:h-7 [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:bg-white [&::-moz-range-thumb]:border-2 [&::-moz-range-thumb]:border-emerald-400 [&::-moz-range-thumb]:shadow-lg"
                    style="background: linear-gradient(to right, rgb(16 185 129) 0%, rgb(6 182 212) var(--volume-percent), rgb(255 255 255 / 0.1) var(--volume-percent), rgb(255 255 255 / 0.1) 100%);"
                    :style="{ '--volume-percent': volume + '%' }" />
                <UIcon name="i-heroicons-speaker-wave" class="text-gray-500 text-sm shrink-0" />
                <span class="text-sm text-white font-medium w-10 text-right">{{ volume }}%</span>
            </div>
        </div>

        <div class="border-t border-white/10"></div>

        <!-- Wave Visualizer -->
        <div class="p-4 flex items-center justify-between cursor-pointer hover:bg-white/5 transition-colors border-t border-white/10"
            @click="emit('toggle', 'waveEnabled')">
            <div class="flex items-center gap-3">
                <div class="w-10 h-10 rounded-full bg-emerald-500/20 flex items-center justify-center">
                    <UIcon name="i-heroicons-signal" class="text-emerald-400 text-lg" />
                </div>
                <div>
                    <p class="text-white font-medium">Wave Visualizer</p>
                    <p class="text-gray-400 text-xs">Audio waveform animation</p>
                </div>
            </div>
            <SettingsToggle :active="settings.waveEnabled" patternId="toggle-pattern-5"
                @click="emit('toggle', 'waveEnabled')" />
        </div>

        <!-- Wave Type Selection -->
        <div v-if="settings.waveEnabled" class="px-4 pb-4">
            <p class="text-gray-400 text-xs mb-2">Visualizer type</p>
            <URadioGroup :modelValue="settings.waveType" :items="waveTypeOptions" orientation="horizontal"
                variant="table" color="primary" size="sm" indicator="hidden"
                @update:modelValue="(val: string) => emit('waveTypeChange', val)" :ui="{
                    item: 'flex-1 bg-white/5 border-white/10 hover:bg-white/10 transition-colors'
                }">
                <template #label="{ item }">
                    <div class="flex flex-col items-center gap-1.5 py-1">
                        <UIcon :name="item.icon" class="text-lg" />
                        <span class="text-xs font-medium">{{ item.label }}</span>
                    </div>
                </template>
            </URadioGroup>
        </div>

        <!-- About Section -->
        <div class="border-t border-white/10 p-4">
            <div class="flex items-center gap-3">
                <div class="w-10 h-10 rounded-full bg-indigo-500/20 flex items-center justify-center">
                    <UIcon name="i-heroicons-information-circle" class="text-indigo-400 text-lg" />
                </div>
                <div>
                    <p class="text-white font-medium">About</p>
                    <p class="text-gray-400 text-xs">Uplayer - Modern Music Player</p>
                </div>
            </div>
        </div>
    </div>
</template>

<script setup lang="ts">
interface Settings {
    soundEnabled: boolean;
    waveEnabled: boolean;
    waveType: 'uniquewave' | 'equalizer';
}

defineProps<{
    settings: Settings;
    volume: number;
}>();

const emit = defineEmits<{
    (e: 'toggle', key: keyof Settings): void;
    (e: 'update:volume', value: number): void;
    (e: 'waveTypeChange', value: string): void;
}>();

const waveTypeOptions = [
    { label: 'Wave', value: 'uniquewave', icon: 'i-heroicons-signal' },
    { label: 'Equalizer', value: 'equalizer', icon: 'i-heroicons-chart-bar' },
];
</script>
