<script setup lang="ts">
import { useAbletonLink } from '~/composables/useAbletonLink'
import { useUnifiedSerial } from '~/composables/useUnifiedSerial'

const { state: linkState, connected: linkConnected, connect: connectLink, disconnect: disconnectLink } = useAbletonLink()
const { isConnected: serialConnected, connect: connectSerial, disconnect: disconnectSerial, audioLevels, currentFrame, firmwareReady, getTxStats } = useUnifiedSerial()

// TX pump stats, refreshed at 2Hz while the page is open (hardware bring-up:
// writes = frames on the wire, coalesced = frames replaced before sending).
const txStats = ref({ writes: 0, dropped: 0 })
let txTimer: ReturnType<typeof setInterval> | null = null
onMounted(() => { txTimer = setInterval(() => { txStats.value = getTxStats() }, 500) })
onUnmounted(() => { if (txTimer) clearInterval(txTimer) })

const tools = [
  { to: '/dmx', title: 'Raw DMX Tester', desc: 'Send individual channel values to the rig' },
  { to: '/mic', title: 'Audio Meter', desc: 'Live FFT bass/mid/high from the ESP32' },
  { to: '/midi', title: 'MIDI Monitor', desc: 'Raw incoming MIDI event stream' },
]
</script>

<template>
  <div class="min-h-screen bg-background text-foreground p-6 max-w-3xl mx-auto">
    <div class="flex items-center justify-between mb-6">
      <h1 class="text-xl font-bold">Diagnostics</h1>
      <NuxtLink to="/controller" class="text-sm text-primary hover:underline">← Back to controller</NuxtLink>
    </div>

    <!-- Connections -->
    <div class="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
      <section class="rounded-xl border border-border bg-card p-4">
        <div class="flex items-center justify-between mb-3">
          <h2 class="text-sm font-semibold">Ableton Link (WS)</h2>
          <span class="w-2 h-2 rounded-full" :class="linkConnected ? 'bg-green-500' : 'bg-zinc-600'" />
        </div>
        <dl class="text-xs font-mono space-y-1 text-muted-foreground">
          <div class="flex justify-between"><dt>tempo</dt><dd class="text-foreground">{{ linkState.tempo.toFixed(2) }}</dd></div>
          <div class="flex justify-between"><dt>beat</dt><dd class="text-foreground">{{ linkState.beat.toFixed(2) }}</dd></div>
          <div class="flex justify-between"><dt>beatInBar</dt><dd class="text-foreground">{{ linkState.beatInBar }}</dd></div>
          <div class="flex justify-between"><dt>peers</dt><dd class="text-foreground">{{ linkState.numPeers }}</dd></div>
          <div class="flex justify-between"><dt>playing</dt><dd :class="linkState.isPlaying ? 'text-green-400' : 'text-red-400'">{{ linkState.isPlaying }}</dd></div>
        </dl>
        <button class="mt-3 w-full py-1.5 rounded text-xs bg-muted hover:bg-accent"
          @click="linkConnected ? disconnectLink() : connectLink()">
          {{ linkConnected ? 'Disconnect' : 'Connect' }}
        </button>
      </section>

      <section class="rounded-xl border border-border bg-card p-4">
        <div class="flex items-center justify-between mb-3">
          <h2 class="text-sm font-semibold">ESP32 Serial</h2>
          <span class="w-2 h-2 rounded-full" :class="serialConnected ? 'bg-green-500' : 'bg-zinc-600'" />
        </div>
        <dl class="text-xs font-mono space-y-1 text-muted-foreground">
          <div class="flex justify-between"><dt>bass</dt><dd class="text-red-400">{{ audioLevels.bass }}</dd></div>
          <div class="flex justify-between"><dt>mid</dt><dd class="text-green-400">{{ audioLevels.mid }}</dd></div>
          <div class="flex justify-between"><dt>high</dt><dd class="text-blue-400">{{ audioLevels.high }}</dd></div>
          <div class="flex justify-between"><dt>frame ch1-5</dt><dd class="text-foreground">{{ currentFrame.slice(0, 5).join(',') }}</dd></div>
          <div class="flex justify-between"><dt>firmware</dt><dd :class="firmwareReady ? 'text-green-400' : 'text-zinc-500'">{{ firmwareReady ? 'ready' : 'waiting' }}</dd></div>
          <div class="flex justify-between"><dt>tx writes</dt><dd class="text-foreground">{{ txStats.writes }}</dd></div>
          <div class="flex justify-between"><dt>tx coalesced</dt><dd class="text-foreground">{{ txStats.dropped }}</dd></div>
        </dl>
        <button class="mt-3 w-full py-1.5 rounded text-xs bg-muted hover:bg-accent"
          @click="serialConnected ? disconnectSerial() : connectSerial()">
          {{ serialConnected ? 'Disconnect' : 'Connect Serial' }}
        </button>
      </section>
    </div>

    <!-- Tools -->
    <h2 class="text-sm font-semibold mb-3 text-muted-foreground uppercase tracking-wide">Tools</h2>
    <div class="grid grid-cols-1 sm:grid-cols-3 gap-3">
      <NuxtLink v-for="t in tools" :key="t.to" :to="t.to"
        class="rounded-xl border border-border bg-card p-4 hover:border-primary transition-colors">
        <div class="font-semibold text-sm mb-1">{{ t.title }}</div>
        <div class="text-xs text-muted-foreground">{{ t.desc }}</div>
      </NuxtLink>
    </div>
  </div>
</template>
