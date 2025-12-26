<template>
    <div class="elastic-toggle cursor-pointer" @click.stop="$emit('click')">
        <div class="svg-wrap" :class="{ 'is-active': active }">
            <svg height="28" width="56" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
                <defs>
                    <pattern :id="patternId" patternUnits="userSpaceOnUse" width="1" height="4">
                        <rect width="100%" height="2" fill="#181a29" />
                        <rect y="2" width="100%" height="2" fill="#202436" />
                    </pattern>
                </defs>
                <rect x="0" y="0" width="56" height="28" :fill="`url(#${patternId})`" />
                <g ref="switchRef" class="switch">
                    <rect x="4" y="4" width="16" height="2" />
                    <rect x="4" y="6" width="16" height="2" />
                    <rect x="4" y="8" width="16" height="2" />
                    <rect x="4" y="10" width="16" height="2" />
                    <rect x="4" y="12" width="16" height="2" />
                    <rect x="4" y="14" width="16" height="2" />
                    <rect x="4" y="16" width="16" height="2" />
                    <rect x="4" y="18" width="16" height="2" />
                    <rect x="4" y="20" width="16" height="2" />
                    <rect x="4" y="22" width="16" height="2" />
                </g>
            </svg>
        </div>
    </div>
</template>

<script setup lang="ts">
import gsap from 'gsap';

const props = defineProps<{
    active: boolean;
    patternId: string;
}>();

defineEmits<{
    click: [];
}>();

const switchRef = ref<SVGGElement | null>(null);

// Animate toggle with GSAP
function animateToggle(newValue: boolean) {
    if (!switchRef.value) return;
    
    const rects = switchRef.value.querySelectorAll('rect');
    if (!rects.length) return;
    
    const targetX = newValue ? 32 : 0;
    
    gsap.to(rects, {
        duration: 1.8,
        x: targetX,
        ease: "elastic.out(1.4, 0.4)",
        stagger: 0.015
    });
}

// Track if it's the first render
const isFirstRender = ref(true);

// Initialize position on mount
onMounted(() => {
    if (switchRef.value) {
        const rects = switchRef.value.querySelectorAll('rect');
        if (rects.length) {
            gsap.set(rects, { x: props.active ? 32 : 0 });
        }
    }
    // After mount, next changes should animate
    nextTick(() => {
        isFirstRender.value = false;
    });
});

// Watch for prop changes - animate after first render
watch(() => props.active, (newVal, oldVal) => {
    if (!switchRef.value) return;
    const rects = switchRef.value.querySelectorAll('rect');
    if (!rects.length) return;
    
    // Skip animation on first render (just set position)
    if (isFirstRender.value) {
        gsap.set(rects, { x: newVal ? 32 : 0 });
        return;
    }
    
    // Animate the toggle with elastic effect
    const targetX = newVal ? 32 : 0;
    gsap.to(rects, {
        duration: 1.8,
        x: targetX,
        ease: "elastic.out(1.4, 0.4)",
        stagger: 0.015
    });
});

// Expose animateToggle for parent component
defineExpose({
    animateToggle
});
</script>
