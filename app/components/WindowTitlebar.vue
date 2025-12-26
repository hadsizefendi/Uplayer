<template>
    <div v-if="windowControls.isTauri.value" data-tauri-drag-region
        class="fixed top-0 inset-x-0 z-50 h-8 flex items-center justify-end gap-2 px-2 select-none">
        <UButton icon="i-solar-minus-square-bold" color="warning" variant="solid"
            class="size-4 flex items-center justify-center" @click="windowControls.minimize()" />
        <UButton
            :icon="showIcons ? (windowControls.isMaximized.value ? 'i-solar-minimize-square-bold' : 'i-solar-maximize-square-bold') : undefined"
            color="success" variant="solid" class="size-4 flex items-center justify-center"
            @click="windowControls.toggleMaximize()" />
        <UButton icon="i-solar-close-square-bold" color="error" variant="solid"
            class="size-4 flex items-center justify-center" @click="windowControls.close()" />
    </div>
</template>

<script setup lang="ts">
const windowControls = useWindowControls()
const showIcons = useState('showWindowControlIcons', () => true)
onMounted(() => windowControls.checkMaximized())
</script>
