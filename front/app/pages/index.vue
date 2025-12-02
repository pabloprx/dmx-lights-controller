<script setup lang="ts">
import { watch } from "vue";

const { state: linkState, connected: linkConnected } = useAbletonLink();
const {
  isSupported: serialSupported,
  isConnected: serialConnected,
  isConnecting: serialConnecting,
  error: serialError,
  receivedData,
  connect: connectSerial,
  disconnect: disconnectSerial,
  sendBeat,
} = useSerial();

// Track previous beat to detect new beats
let lastBeatInt = -1;

// Send beat to Arduino when beat changes
watch(
  () => linkState.value.beat,
  (beat) => {
    const currentBeatInt = Math.floor(beat);
    if (currentBeatInt !== lastBeatInt && serialConnected.value) {
      lastBeatInt = currentBeatInt;
      sendBeat(linkState.value.beatInBar, linkState.value.tempo);
    }
  }
);
</script>

<template>
  <div class="max-w-xl mx-auto p-5 font-mono text-white bg-black min-h-screen">
    <h1 class="text-center mb-5">DMX Controller</h1>

    <NuxtLink
      to="/controller"
      class="block w-full p-3 text-center no-underline mb-5 bg-cyan-400 text-black font-mono"
    >
      Open Controller UI →
    </NuxtLink>

    <!-- Big Beat Number - RED when playing -->
    <div
      class="w-48 h-48 mx-auto mb-5 flex items-center justify-center text-8xl font-bold"
      :class="linkState.isPlaying ? 'bg-red-600 text-white' : 'bg-neutral-800 text-neutral-600'"
    >
      {{ linkState.isPlaying ? linkState.beatInBar : '-' }}
    </div>

    <!-- Raw WS Data Table -->
    <section class="bg-neutral-900 border border-neutral-700 p-4 mb-4">
      <h2 class="m-0 mb-2 text-sm text-neutral-500">Ableton Link (Raw WS)</h2>
      <table class="w-full text-sm border-collapse">
        <tbody>
          <tr class="border-b border-neutral-800">
            <td class="py-1.5 px-2 text-neutral-500">WS Connected</td>
            <td class="py-1.5 px-2 text-right font-mono" :class="linkConnected ? 'text-green-500' : 'text-red-500'">{{ linkConnected }}</td>
          </tr>
          <tr class="border-b border-neutral-800">
            <td class="py-1.5 px-2 text-neutral-500">enabled</td>
            <td class="py-1.5 px-2 text-right font-mono">{{ linkState.enabled }}</td>
          </tr>
          <tr class="border-b border-neutral-800">
            <td class="py-1.5 px-2 text-neutral-500">isPlaying</td>
            <td class="py-1.5 px-2 text-right font-mono" :class="linkState.isPlaying ? 'text-green-500' : 'text-red-500'">{{ linkState.isPlaying }}</td>
          </tr>
          <tr class="border-b border-neutral-800">
            <td class="py-1.5 px-2 text-neutral-500">numPeers</td>
            <td class="py-1.5 px-2 text-right font-mono">{{ linkState.numPeers }}</td>
          </tr>
          <tr class="border-b border-neutral-800">
            <td class="py-1.5 px-2 text-neutral-500">tempo</td>
            <td class="py-1.5 px-2 text-right font-mono">{{ linkState.tempo.toFixed(2) }} BPM</td>
          </tr>
          <tr class="border-b border-neutral-800">
            <td class="py-1.5 px-2 text-neutral-500">beat</td>
            <td class="py-1.5 px-2 text-right font-mono">{{ linkState.beat.toFixed(3) }}</td>
          </tr>
          <tr class="border-b border-neutral-800">
            <td class="py-1.5 px-2 text-neutral-500">phase</td>
            <td class="py-1.5 px-2 text-right font-mono">{{ linkState.phase.toFixed(3) }}</td>
          </tr>
          <tr class="border-b border-neutral-800">
            <td class="py-1.5 px-2 text-neutral-500">beatInBar</td>
            <td class="py-1.5 px-2 text-right font-mono text-2xl font-bold">{{ linkState.beatInBar }}</td>
          </tr>
          <tr class="border-b border-neutral-800">
            <td class="py-1.5 px-2 text-neutral-500">quantum</td>
            <td class="py-1.5 px-2 text-right font-mono">{{ linkState.quantum }}</td>
          </tr>
          <tr>
            <td class="py-1.5 px-2 text-neutral-500">lastBeatTime</td>
            <td class="py-1.5 px-2 text-right font-mono">{{ linkState.lastBeatTime }}</td>
          </tr>
        </tbody>
      </table>
    </section>

    <!-- Serial Connection -->
    <section class="bg-neutral-900 border border-neutral-700 p-4 mb-4">
      <h2 class="m-0 mb-2 text-sm text-neutral-500">Arduino / ESP32</h2>

      <div v-if="!serialSupported" class="bg-yellow-900/50 text-yellow-500 p-2.5 text-center">
        Web Serial API not supported. Use Chrome or Edge.
      </div>

      <div v-else>
        <table class="w-full text-sm border-collapse">
          <tbody>
            <tr>
              <td class="py-1.5 px-2 text-neutral-500">Status</td>
              <td class="py-1.5 px-2 text-right font-mono" :class="serialConnected ? 'text-green-500' : 'text-red-500'">
                {{ serialConnected ? "Connected" : "Disconnected" }}
              </td>
            </tr>
          </tbody>
        </table>

        <div v-if="serialError" class="text-red-500 my-2.5">{{ serialError }}</div>

        <button
          v-if="!serialConnected"
          class="w-full p-3 border-none font-mono text-sm cursor-pointer bg-green-500 text-black mt-2.5 disabled:bg-neutral-700 disabled:text-neutral-500 disabled:cursor-not-allowed"
          :disabled="serialConnecting"
          @click="connectSerial()"
        >
          {{ serialConnecting ? "Connecting..." : "Connect Serial" }}
        </button>

        <button
          v-else
          class="w-full p-3 border-none font-mono text-sm cursor-pointer bg-neutral-700 text-white mt-2.5"
          @click="disconnectSerial()"
        >
          Disconnect
        </button>

        <div v-if="serialConnected && receivedData" class="mt-2.5">
          <div class="text-neutral-500 mb-1">Arduino Output:</div>
          <pre class="bg-black border border-neutral-700 p-2.5 text-xs max-h-24 overflow-y-auto whitespace-pre-wrap break-all m-0">{{ receivedData }}</pre>
        </div>
      </div>
    </section>
  </div>
</template>
