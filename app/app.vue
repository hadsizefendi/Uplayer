<template>
  <UApp :toaster="{ position: 'top-center', duration: 5000, expand: true }">
    <div class="app-container">
      <NuxtPage />
    </div>
  </UApp>
</template>

<script setup lang="ts">
useHead({
  title: 'Uplayer - Music Player',
  meta: [
    { name: 'description', content: 'Uplayer - Modern desktop music player' },
    { name: 'viewport', content: 'width=device-width, initial-scale=1' },
    { name: 'color-scheme', content: 'dark' }
  ],
  htmlAttrs: {
    lang: 'en',
    class: 'dark'
  }
})

// Force dark mode
onMounted(() => {
  document.documentElement.classList.add('dark')
  document.documentElement.style.colorScheme = 'dark'
})
</script>

<style>
/* En kök katmanların HEPSİNİ şeffaf yapmalıyız */
:root, html, body, #__nuxt {
  background-color: transparent !important;
  background: transparent !important;
  margin: 0;
  padding: 0;
  overflow: hidden;
}

/* Uygulamanın GÖRÜNEN ana kutusu */
.app-container {
  background: linear-gradient(to bottom right, rgb(3, 7, 18), rgb(30, 27, 75), rgb(3, 7, 18));
  height: 100vh;
  width: 100vw;
  border-radius: 12px;
  overflow: hidden;
  border: 1px solid rgba(255, 255, 255, 0.1);
}
</style>