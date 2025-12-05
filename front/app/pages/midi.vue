<script setup lang="ts">
const midi = useMIDI()

// Auto-connect on mount
onMounted(() => {
  midi.connect()
})

// Format event for display
function formatEvent(event: MIDIEvent): string {
  switch (event.type) {
    case 'noteon':
      return `NOTE ON  ${event.noteName} (${event.note}) vel=${event.velocity}`
    case 'noteoff':
      return `NOTE OFF ${event.noteName} (${event.note})`
    case 'cc':
      return `CC ${event.cc?.toString().padStart(3, ' ')} = ${event.value}`
    case 'pitchbend':
      return `PITCH BEND ${event.pitchBend}`
    default:
      return `RAW [${event.raw.map(b => b.toString(16).padStart(2, '0')).join(' ')}]`
  }
}

// Color for event type
function getEventColor(type: string): string {
  switch (type) {
    case 'noteon':
      return 'text-green-400'
    case 'noteoff':
      return 'text-red-400'
    case 'cc':
      return 'text-yellow-400'
    case 'pitchbend':
      return 'text-purple-400'
    default:
      return 'text-neutral-400'
  }
}

// Import type for template
import type { MIDIEvent } from '~/composables/useMIDI'
</script>

<template>
  <div class="min-h-screen bg-neutral-950 text-white p-8">
    <div class="max-w-5xl mx-auto">
      <div class="flex items-center justify-between mb-8">
        <h1 class="text-3xl font-bold">MIDI Controller</h1>
        <NuxtLink to="/controller" class="text-neutral-400 hover:text-white transition">
          ← Back to Controller
        </NuxtLink>
      </div>

      <!-- Connection Status -->
      <div class="bg-neutral-900 rounded-xl p-6 mb-6">
        <div class="flex items-center justify-between">
          <div class="flex items-center gap-4">
            <div
              :class="[
                'w-3 h-3 rounded-full',
                midi.isConnected.value ? 'bg-green-500 animate-pulse' : 'bg-neutral-600'
              ]"
            />
            <span class="font-medium">
              {{ midi.isConnected.value ? 'Listening for MIDI' : 'Not connected' }}
            </span>
          </div>
          <div class="flex gap-2">
            <button
              v-if="!midi.isConnected.value"
              class="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg font-medium transition"
              @click="midi.connect()"
            >
              Connect MIDI
            </button>
            <button
              v-else
              class="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg font-medium transition"
              @click="midi.disconnect()"
            >
              Disconnect
            </button>
            <button
              class="bg-neutral-700 hover:bg-neutral-600 text-white px-4 py-2 rounded-lg font-medium transition"
              @click="midi.clearEvents()"
            >
              Clear Log
            </button>
          </div>
        </div>

        <!-- API Support Warning -->
        <div v-if="!midi.isSupported.value" class="mt-4 p-4 bg-red-900/50 rounded-lg text-red-200">
          Web MIDI API is not supported in this browser. Try Chrome or Edge.
        </div>
      </div>

      <!-- Devices List -->
      <div class="bg-neutral-900 rounded-xl p-6 mb-6">
        <h2 class="text-lg font-semibold mb-4 text-neutral-400">MIDI Devices</h2>
        <div v-if="midi.devices.value.length === 0" class="text-neutral-500">
          No MIDI devices detected. Connect a device and click "Connect MIDI".
        </div>
        <div v-else class="space-y-2">
          <div
            v-for="device in midi.devices.value"
            :key="device.id"
            class="flex items-center gap-3 p-3 bg-neutral-800 rounded-lg"
          >
            <div
              :class="[
                'w-2 h-2 rounded-full',
                device.connected ? 'bg-green-500' : 'bg-neutral-600'
              ]"
            />
            <span class="font-mono">{{ device.name }}</span>
            <span class="text-neutral-500 text-sm">{{ device.manufacturer }}</span>
          </div>
        </div>
      </div>

      <!-- Last Event (big display) -->
      <div class="bg-neutral-900 rounded-xl p-6 mb-6">
        <h2 class="text-lg font-semibold mb-4 text-neutral-400">Last Input</h2>
        <div
          v-if="midi.lastEvent.value"
          class="p-6 bg-neutral-800 rounded-lg"
        >
          <div class="flex items-center gap-4 mb-4">
            <span
              :class="[
                'text-xs font-bold px-2 py-1 rounded uppercase',
                midi.lastEvent.value.type === 'noteon' ? 'bg-green-600' :
                midi.lastEvent.value.type === 'noteoff' ? 'bg-red-600' :
                midi.lastEvent.value.type === 'cc' ? 'bg-yellow-600' :
                midi.lastEvent.value.type === 'pitchbend' ? 'bg-purple-600' :
                'bg-neutral-600'
              ]"
            >
              {{ midi.lastEvent.value.type }}
            </span>
            <span class="text-neutral-500 text-sm">CH {{ midi.lastEvent.value.channel }}</span>
            <span class="text-neutral-600 text-sm ml-auto">{{ midi.lastEvent.value.deviceName }}</span>
          </div>

          <!-- Note display -->
          <div v-if="midi.lastEvent.value.type === 'noteon' || midi.lastEvent.value.type === 'noteoff'" class="grid grid-cols-3 gap-4">
            <div class="text-center">
              <div class="text-4xl font-bold font-mono">{{ midi.lastEvent.value.noteName }}</div>
              <div class="text-neutral-500 text-sm">Note</div>
            </div>
            <div class="text-center">
              <div class="text-4xl font-bold font-mono">{{ midi.lastEvent.value.note }}</div>
              <div class="text-neutral-500 text-sm">MIDI #</div>
            </div>
            <div class="text-center">
              <div class="text-4xl font-bold font-mono">{{ midi.lastEvent.value.velocity }}</div>
              <div class="text-neutral-500 text-sm">Velocity</div>
            </div>
          </div>

          <!-- CC display -->
          <div v-else-if="midi.lastEvent.value.type === 'cc'" class="grid grid-cols-2 gap-4">
            <div class="text-center">
              <div class="text-4xl font-bold font-mono">CC {{ midi.lastEvent.value.cc }}</div>
              <div class="text-neutral-500 text-sm">Control</div>
            </div>
            <div class="text-center">
              <div class="text-4xl font-bold font-mono">{{ midi.lastEvent.value.value }}</div>
              <div class="text-neutral-500 text-sm">Value</div>
              <div class="mt-2 h-2 bg-neutral-700 rounded-full overflow-hidden">
                <div
                  class="h-full bg-yellow-500 transition-all duration-75"
                  :style="{ width: `${((midi.lastEvent.value.value || 0) / 127) * 100}%` }"
                />
              </div>
            </div>
          </div>

          <!-- Pitch bend display -->
          <div v-else-if="midi.lastEvent.value.type === 'pitchbend'" class="text-center">
            <div class="text-4xl font-bold font-mono">{{ midi.lastEvent.value.pitchBend }}</div>
            <div class="text-neutral-500 text-sm">Pitch Bend (0-16383, center=8192)</div>
            <div class="mt-2 h-2 bg-neutral-700 rounded-full overflow-hidden">
              <div
                class="h-full bg-purple-500 transition-all duration-75"
                :style="{ width: `${((midi.lastEvent.value.pitchBend || 8192) / 16383) * 100}%` }"
              />
            </div>
          </div>

          <!-- Raw bytes -->
          <div class="mt-4 pt-4 border-t border-neutral-700">
            <span class="text-neutral-500 text-xs font-mono">
              RAW: [{{ midi.lastEvent.value.raw.map(b => '0x' + b.toString(16).padStart(2, '0').toUpperCase()).join(', ') }}]
            </span>
          </div>
        </div>
        <div v-else class="p-6 bg-neutral-800 rounded-lg text-center text-neutral-500">
          Press a key or move a knob on your MIDI controller...
        </div>
      </div>

      <!-- Event Log -->
      <div class="bg-neutral-900 rounded-xl p-6">
        <div class="flex items-center justify-between mb-4">
          <h2 class="text-lg font-semibold text-neutral-400">Event Log</h2>
          <span class="text-neutral-600 text-sm">{{ midi.events.value.length }} events</span>
        </div>
        <div class="h-80 overflow-y-auto font-mono text-sm bg-neutral-950 rounded-lg p-4 space-y-1">
          <div v-if="midi.events.value.length === 0" class="text-neutral-600">
            Waiting for MIDI events...
          </div>
          <div
            v-for="event in midi.events.value"
            :key="event.id"
            class="flex items-center gap-3 py-1 border-b border-neutral-900"
          >
            <span class="text-neutral-600 text-xs w-20">
              {{ new Date(event.timestamp).toLocaleTimeString() }}
            </span>
            <span class="text-neutral-500 w-6">CH{{ event.channel }}</span>
            <span :class="getEventColor(event.type)">{{ formatEvent(event) }}</span>
          </div>
        </div>
      </div>

      <!-- Instructions -->
      <div class="mt-8 p-6 bg-neutral-900/50 rounded-xl text-neutral-400 text-sm">
        <h3 class="font-semibold mb-2 text-neutral-300">How to use:</h3>
        <ol class="list-decimal list-inside space-y-1">
          <li>Connect your QMK MIDI controller</li>
          <li>Click "Connect MIDI" to request browser access</li>
          <li>Press keys or turn knobs - events will appear in the log</li>
          <li>Tell me what you see (e.g., "CC 1 = 64") and what you want it to do</li>
          <li>We'll map those controls in the next step</li>
        </ol>
      </div>
    </div>
  </div>
</template>
