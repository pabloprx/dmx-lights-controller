<script setup lang="ts">
import type { PresetValues, StrobeSpeed, DeviceProfile, Preset, PresetAudioReactive, AudioBand, AudioCurve } from '~/types/dmx'
import {
  createDefaultValues,
  createDefaultChannelValues,
  createDefaultAudioReactive,
  getPreviewColor,
  getPresetDisplayColor,
  valuesToDMX,
  getProfileById,
} from '~/types/dmx'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

const props = defineProps<{
  open: boolean
  deviceId: string              // Target device for preview
  preset?: Preset | null        // Existing preset to edit, or null for new
  beat?: number                 // Which beat this is for (for naming)
}>()

const emit = defineEmits<{
  'update:open': [value: boolean]
  save: [preset: Omit<Preset, 'id'>]
  discard: []
}>()

const store = useDMXStore()
const { sendDMX, audioLevels } = useUnifiedSerial()

// Get device and profile info
const device = computed(() => store.getDevice(props.deviceId))
const profile = computed((): DeviceProfile | null => {
  if (!device.value) return null
  return getProfileById(device.value.profileId) || null
})
const controlType = computed(() => profile.value?.controlType || 'rgbw')

// Form state - RGBW values
const name = ref('')
const rgbwValues = ref<PresetValues>(createDefaultValues())

// Form state - Generic channel values (for sliders profiles)
const channelValues = ref<number[]>([])

// Form state - Audio reactive settings
const audioReactive = ref<PresetAudioReactive>(createDefaultAudioReactive())

// Audio band options
const audioBandOptions: { value: AudioBand; label: string }[] = [
  { value: 'bass', label: 'Bass' },
  { value: 'mid', label: 'Mids' },
  { value: 'high', label: 'Highs' },
]

// Curve options for audio response
const curveOptions: { value: AudioCurve; label: string; icon: string }[] = [
  { value: 'square', label: 'Square', icon: '⊓' },   // Instant on/off
  { value: 'linear', label: 'Linear', icon: '⟋' },   // Proportional
  { value: 'sine', label: 'Smooth', icon: '∿' },     // Ease in-out
]

// Channel options for audio modulation
const channelOptions = computed(() => {
  if (controlType.value === 'rgbw') {
    return [
      { value: 0, label: 'Dimmer' },
      { value: 1, label: 'Red' },
      { value: 2, label: 'Green' },
      { value: 3, label: 'Blue' },
      { value: 4, label: 'White' },
    ]
  }
  // For other profiles, use channel names from profile
  if (profile.value?.channels) {
    return profile.value.channels.map((ch, idx) => ({
      value: idx,
      label: ch.name,
    }))
  }
  return [{ value: 0, label: 'Ch 1' }]
})

// Track original values for discard
const originalDMX = ref<number[]>([])

// Initialize form when modal opens or preset changes
watch([() => props.open, () => props.preset], ([isOpen]) => {
  if (!isOpen) return

  // Capture original DMX state for discard
  originalDMX.value = new Array(16).fill(0)

  if (props.preset) {
    // Editing existing preset
    name.value = props.preset.name
    if (props.preset.values) {
      rgbwValues.value = { ...props.preset.values }
    }
    if (props.preset.channelValues) {
      channelValues.value = [...props.preset.channelValues]
    }
    // Load audio reactive settings
    if (props.preset.audioReactive) {
      audioReactive.value = { ...props.preset.audioReactive }
    } else {
      audioReactive.value = createDefaultAudioReactive()
    }
  } else {
    // Creating new preset
    const beatLabel = props.beat ? ` B${props.beat}` : ''
    const deviceName = device.value?.name || 'Preset'
    name.value = `${deviceName}${beatLabel}`

    if (controlType.value === 'rgbw') {
      rgbwValues.value = createDefaultValues()
    } else if (profile.value) {
      channelValues.value = createDefaultChannelValues(profile.value.id)
    }
    // Reset audio reactive to default
    audioReactive.value = createDefaultAudioReactive()
  }
}, { immediate: true })

// Preview color for header
const previewColor = computed(() => {
  if (controlType.value === 'rgbw') {
    return getPreviewColor(rgbwValues.value)
  }
  // For sliders, use channel values to compute color
  if (profile.value && channelValues.value.length > 0) {
    const colorChannel = profile.value.channels.find(c => c.name === 'Color')
    if (colorChannel) {
      const colorValue = channelValues.value[colorChannel.offset] || 0
      const hue = (colorValue / 255) * 360
      return `hsl(${hue}, 70%, 50%)`
    }
  }
  return '#8b5cf6'
})

// Live preview - send DMX when values change
watch([rgbwValues, channelValues], () => {
  if (!props.open || !device.value) return

  const dmxArray = new Array(16).fill(0)
  const start = device.value.startChannel - 1

  if (controlType.value === 'rgbw') {
    const channels = valuesToDMX(rgbwValues.value)
    for (let i = 0; i < channels.length && start + i < 16; i++) {
      dmxArray[start + i] = channels[i]
    }
  } else {
    for (let i = 0; i < channelValues.value.length && start + i < 16; i++) {
      dmxArray[start + i] = channelValues.value[i]
    }
  }

  sendDMX(dmxArray)
}, { deep: true })

// Quick color options for RGBW
const quickColors = [
  { name: 'Red', r: 255, g: 0, b: 0 },
  { name: 'Green', r: 0, g: 255, b: 0 },
  { name: 'Blue', r: 0, g: 0, b: 255 },
  { name: 'Cyan', r: 0, g: 255, b: 255 },
  { name: 'Magenta', r: 255, g: 0, b: 255 },
  { name: 'Yellow', r: 255, g: 255, b: 0 },
  { name: 'Orange', r: 255, g: 128, b: 0 },
  { name: 'White', r: 255, g: 255, b: 255 },
]

const strobeOptions: { value: StrobeSpeed; label: string }[] = [
  { value: 'slow', label: 'Slow' },
  { value: 'medium', label: 'Med' },
  { value: 'fast', label: 'Fast' },
]

function setQuickColor(color: { r: number, g: number, b: number }) {
  rgbwValues.value.red = color.r
  rgbwValues.value.green = color.g
  rgbwValues.value.blue = color.b
}

function handleSave() {
  if (!name.value.trim() || !profile.value) return

  const preset: Omit<Preset, 'id'> = {
    name: name.value.trim(),
    profileId: profile.value.id,
    isBuiltIn: false,
    category: 'custom',
  }

  if (controlType.value === 'rgbw') {
    preset.values = { ...rgbwValues.value }
  } else {
    preset.channelValues = [...channelValues.value]
  }

  // Include audio reactive settings if enabled
  if (audioReactive.value.enabled) {
    preset.audioReactive = { ...audioReactive.value }
  }

  emit('save', preset)
  emit('update:open', false)
}

function handleDiscard() {
  // Revert to original DMX state
  if (device.value) {
    sendDMX(originalDMX.value)
  }
  emit('discard')
  emit('update:open', false)
}

function handleCancel() {
  // Revert to original DMX state
  if (device.value) {
    sendDMX(originalDMX.value)
  }
  emit('update:open', false)
}
</script>

<template>
  <Dialog :open="open" @update:open="emit('update:open', $event)">
    <DialogContent class="max-w-lg bg-neutral-900 border-neutral-700 text-white max-h-[85vh] overflow-y-auto">
      <DialogHeader>
        <div class="flex items-center gap-3">
          <div
            class="w-10 h-10 rounded-lg border border-neutral-600"
            :style="{ backgroundColor: previewColor }"
          />
          <div>
            <DialogTitle class="text-white">
              {{ preset ? 'Edit Preset' : 'New Preset' }}
            </DialogTitle>
            <div class="text-xs text-zinc-500">
              {{ device?.name }} · {{ profile?.name }}
            </div>
          </div>
        </div>
      </DialogHeader>

      <div class="flex flex-col gap-4 py-4">
        <!-- Preset Name -->
        <div class="flex flex-col gap-1">
          <label class="text-xs text-neutral-400">Name</label>
          <Input
            v-model="name"
            type="text"
            placeholder="e.g. Red Strobe"
            class="bg-neutral-800 border-neutral-600 text-white"
          />
        </div>

        <!-- ════════════════════════════════════════════════════════════
             RGBW CONTROLS (for rgbw profiles like PinSpot)
             ════════════════════════════════════════════════════════════ -->
        <template v-if="controlType === 'rgbw'">
          <!-- Quick Colors -->
          <div class="flex flex-col gap-2">
            <label class="text-xs text-neutral-400">Quick Colors</label>
            <div class="grid grid-cols-8 gap-1.5">
              <button
                v-for="color in quickColors"
                :key="color.name"
                class="aspect-square rounded-lg border-2 transition-all"
                :class="
                  rgbwValues.red === color.r && rgbwValues.green === color.g && rgbwValues.blue === color.b
                    ? 'border-white scale-105'
                    : 'border-transparent hover:scale-105'
                "
                :style="{ backgroundColor: `rgb(${color.r}, ${color.g}, ${color.b})` }"
                :title="color.name"
                @click="setQuickColor(color)"
              />
            </div>
          </div>

          <!-- Dimmer / Strobe Toggle -->
          <div class="flex flex-col gap-2">
            <div class="flex items-center justify-between">
              <label class="text-xs text-neutral-400">Mode</label>
              <div class="flex gap-2">
                <button
                  class="px-3 py-1 rounded text-xs font-medium"
                  :class="!rgbwValues.strobe ? 'bg-green-600 text-white' : 'bg-neutral-700 text-neutral-300'"
                  @click="rgbwValues.strobe = false"
                >
                  Dimmer
                </button>
                <button
                  class="px-3 py-1 rounded text-xs font-medium"
                  :class="rgbwValues.strobe ? 'bg-amber-500 text-black' : 'bg-neutral-700 text-neutral-300'"
                  @click="rgbwValues.strobe = true"
                >
                  Strobe
                </button>
              </div>
            </div>

            <!-- Dimmer Slider -->
            <div v-if="!rgbwValues.strobe" class="flex items-center gap-3">
              <span class="w-14 text-xs text-neutral-400">Dimmer</span>
              <input
                v-model.number="rgbwValues.dimmer"
                type="range"
                min="0"
                max="255"
                class="flex-1 accent-green-500"
              >
              <span class="w-10 text-xs text-neutral-400 text-right font-mono">
                {{ Math.round((rgbwValues.dimmer / 255) * 100) }}%
              </span>
            </div>

            <!-- Strobe Speed -->
            <div v-else class="flex items-center gap-2">
              <span class="text-xs text-neutral-400">Speed:</span>
              <button
                v-for="opt in strobeOptions"
                :key="opt.value"
                class="px-3 py-1 rounded text-xs"
                :class="rgbwValues.strobeSpeed === opt.value ? 'bg-amber-500 text-black' : 'bg-neutral-700 text-neutral-300'"
                @click="rgbwValues.strobeSpeed = opt.value"
              >
                {{ opt.label }}
              </button>
            </div>
          </div>

          <!-- White (opacity/fill) Slider - before colors -->
          <div class="flex flex-col gap-2">
            <label class="text-xs text-neutral-400">White LED (fill/opacity)</label>
            <div class="flex items-center gap-2">
              <span class="w-6 text-xs font-bold text-neutral-200">W</span>
              <input v-model.number="rgbwValues.white" type="range" min="0" max="255" class="flex-1 accent-neutral-300">
              <span class="w-8 text-xs text-neutral-400 text-right font-mono">{{ rgbwValues.white }}</span>
            </div>
          </div>

          <!-- RGB Sliders -->
          <div class="flex flex-col gap-2">
            <label class="text-xs text-neutral-400">RGB Color</label>
            <div class="grid gap-2">
              <div class="flex items-center gap-2">
                <span class="w-6 text-xs font-bold text-red-400">R</span>
                <input v-model.number="rgbwValues.red" type="range" min="0" max="255" class="flex-1 accent-red-500">
                <span class="w-8 text-xs text-neutral-400 text-right font-mono">{{ rgbwValues.red }}</span>
              </div>
              <div class="flex items-center gap-2">
                <span class="w-6 text-xs font-bold text-green-400">G</span>
                <input v-model.number="rgbwValues.green" type="range" min="0" max="255" class="flex-1 accent-green-500">
                <span class="w-8 text-xs text-neutral-400 text-right font-mono">{{ rgbwValues.green }}</span>
              </div>
              <div class="flex items-center gap-2">
                <span class="w-6 text-xs font-bold text-blue-400">B</span>
                <input v-model.number="rgbwValues.blue" type="range" min="0" max="255" class="flex-1 accent-blue-500">
                <span class="w-8 text-xs text-neutral-400 text-right font-mono">{{ rgbwValues.blue }}</span>
              </div>
            </div>
          </div>
        </template>

        <!-- ════════════════════════════════════════════════════════════
             SLIDER CONTROLS (for profiles like Laser)
             ════════════════════════════════════════════════════════════ -->
        <template v-else-if="controlType === 'sliders' && profile">
          <div class="flex flex-col gap-2">
            <label class="text-xs text-neutral-400">Channels</label>
            <div class="grid gap-2">
              <div
                v-for="(channel, idx) in profile.channels"
                :key="channel.offset"
                class="channel-row"
              >
                <div class="channel-info">
                  <span class="channel-name">{{ channel.name }}</span>
                  <span v-if="channel.description" class="channel-desc">{{ channel.description }}</span>
                </div>
                <div class="channel-control">
                  <input
                    v-model.number="channelValues[idx]"
                    type="range"
                    :min="channel.min"
                    :max="channel.max"
                    class="channel-slider"
                  >
                  <span class="channel-value">{{ channelValues[idx] }}</span>
                </div>
              </div>
            </div>
          </div>
        </template>

        <!-- ════════════════════════════════════════════════════════════
             AUDIO REACTIVE SETTINGS
             ════════════════════════════════════════════════════════════ -->
        <div class="flex flex-col gap-3 pt-3 border-t border-neutral-700">
          <div class="flex items-center justify-between">
            <label class="text-xs text-neutral-400 flex items-center gap-2">
              <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
              </svg>
              Audio Reactive
            </label>
            <button
              class="px-3 py-1 rounded text-xs font-medium transition-colors"
              :class="audioReactive.enabled ? 'bg-purple-600 text-white' : 'bg-neutral-700 text-neutral-400'"
              @click="audioReactive.enabled = !audioReactive.enabled"
            >
              {{ audioReactive.enabled ? 'ON' : 'OFF' }}
            </button>
          </div>

          <template v-if="audioReactive.enabled">
            <!-- Band Selection -->
            <div class="flex items-center gap-2">
              <span class="text-xs text-neutral-400 w-16">Follow:</span>
              <div class="flex gap-1">
                <button
                  v-for="opt in audioBandOptions"
                  :key="opt.value"
                  class="px-3 py-1 rounded text-xs font-medium transition-colors"
                  :class="audioReactive.band === opt.value
                    ? 'bg-purple-600 text-white'
                    : 'bg-neutral-700 text-neutral-300 hover:bg-neutral-600'"
                  @click="audioReactive.band = opt.value"
                >
                  {{ opt.label }}
                </button>
              </div>
              <!-- Live level indicator with gate marker -->
              <div class="flex-1 h-3 bg-neutral-800 rounded overflow-hidden ml-2 relative">
                <!-- Gate threshold marker -->
                <div
                  class="absolute top-0 bottom-0 w-0.5 bg-neutral-500 z-10"
                  :style="{ left: `${audioReactive.threshold}%` }"
                />
                <!-- Level bar - changes color when above gate -->
                <div
                  class="h-full transition-all duration-75"
                  :class="audioLevels[audioReactive.band] >= audioReactive.threshold ? 'bg-red-500' : 'bg-purple-500/50'"
                  :style="{ width: `${audioLevels[audioReactive.band]}%` }"
                />
              </div>
              <!-- Active indicator -->
              <div
                class="w-2 h-2 rounded-full transition-colors"
                :class="audioLevels[audioReactive.band] >= audioReactive.threshold ? 'bg-red-500 animate-pulse' : 'bg-neutral-600'"
              />
            </div>

            <!-- Channel to modulate -->
            <div class="flex items-center gap-2">
              <span class="text-xs text-neutral-400 w-16">Channel:</span>
              <select
                v-model.number="audioReactive.channel"
                class="flex-1 px-2 py-1 rounded bg-neutral-700 border border-neutral-600 text-sm text-white"
              >
                <option v-for="opt in channelOptions" :key="opt.value" :value="opt.value">
                  {{ opt.label }}
                </option>
              </select>
            </div>

            <!-- Threshold - gate for when to start reacting -->
            <div class="flex items-center gap-2">
              <span class="text-xs text-neutral-400 w-16">Gate:</span>
              <input
                v-model.number="audioReactive.threshold"
                type="range"
                min="0"
                max="100"
                class="flex-1 accent-purple-500"
              >
              <span class="w-10 text-xs text-neutral-400 text-right font-mono">{{ audioReactive.threshold }}%</span>
            </div>
            <div class="text-[10px] text-neutral-500 -mt-1 ml-16">
              Only react when audio level is above this
            </div>

            <!-- Output Range - min/max intensity -->
            <div class="flex items-center gap-2">
              <span class="text-xs text-neutral-400 w-16">Output:</span>
              <div class="flex-1 flex items-center gap-2">
                <input
                  v-model.number="audioReactive.min"
                  type="number"
                  min="0"
                  max="100"
                  class="w-14 px-2 py-1 rounded bg-neutral-700 border border-neutral-600 text-sm text-white text-center"
                >
                <span class="text-neutral-500">%</span>
                <span class="text-neutral-600">to</span>
                <input
                  v-model.number="audioReactive.max"
                  type="number"
                  min="0"
                  max="100"
                  class="w-14 px-2 py-1 rounded bg-neutral-700 border border-neutral-600 text-sm text-white text-center"
                >
                <span class="text-neutral-500">%</span>
              </div>
            </div>
            <div class="text-[10px] text-neutral-500 -mt-1 ml-16">
              Channel intensity range (e.g. 80-100% = never off, pulses on peaks)
            </div>

            <!-- Curve selector -->
            <div class="flex items-center gap-2">
              <span class="text-xs text-neutral-400 w-16">Curve:</span>
              <div class="flex gap-1">
                <button
                  v-for="opt in curveOptions"
                  :key="opt.value"
                  class="px-3 py-1 rounded text-xs font-medium transition-colors flex items-center gap-1"
                  :class="audioReactive.curve === opt.value
                    ? 'bg-purple-600 text-white'
                    : 'bg-neutral-700 text-neutral-300 hover:bg-neutral-600'"
                  @click="audioReactive.curve = opt.value"
                  :title="opt.label"
                >
                  <span class="text-base">{{ opt.icon }}</span>
                  <span>{{ opt.label }}</span>
                </button>
              </div>
            </div>
            <div class="text-[10px] text-neutral-500 -mt-1 ml-16">
              Square = instant, Linear = proportional, Smooth = eased
            </div>
          </template>
        </div>
      </div>

      <DialogFooter class="flex gap-2">
        <Button
          variant="outline"
          class="text-red-400 border-red-500/30 hover:bg-red-500/10"
          @click="handleDiscard"
        >
          Discard
        </Button>
        <div class="flex-1" />
        <Button variant="secondary" @click="handleCancel">Cancel</Button>
        <Button class="bg-green-600 hover:bg-green-700 text-white" @click="handleSave">
          {{ preset ? 'Update' : 'Save' }}
        </Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
</template>

<style scoped>
/* Channel sliders for Laser */
.channel-row {
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding: 8px 12px;
  background: #22232b;
  border: 1px solid #383944;
  border-radius: 6px;
}

.channel-info {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.channel-name {
  font-size: 11px;
  font-weight: 500;
  color: #f0f0f5;
}

.channel-desc {
  font-size: 9px;
  color: #8888a0;
  font-family: 'JetBrains Mono', monospace;
}

.channel-control {
  display: flex;
  align-items: center;
  gap: 12px;
}

.channel-slider {
  flex: 1;
  height: 6px;
  cursor: pointer;
  accent-color: #8b5cf6;
}

.channel-value {
  font-size: 11px;
  font-family: 'JetBrains Mono', monospace;
  min-width: 28px;
  text-align: right;
  color: #8b5cf6;
}
</style>
