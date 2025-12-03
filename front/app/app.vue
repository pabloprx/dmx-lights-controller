<template>
  <NuxtRouteAnnouncer />
  <NuxtPage />
</template>

<script lang="ts" setup>
// Apply dark theme to HTML element so Teleport dialogs also get dark styling
useHead({
  htmlAttrs: {
    class: 'dark'
  },
  bodyAttrs: {
    class: 'bg-background text-foreground'
  }
})
</script>
