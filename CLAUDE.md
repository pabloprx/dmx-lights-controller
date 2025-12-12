# DMX App - Claude Context

## Project Structure
- `front/` - Nuxt 4 frontend (Vue 3, TypeScript)
- `serial/dmx_beat/` - ESP32 Arduino firmware (FFT + DMX output)

## Key Composables

### useDMXStore
Central state: devices, presets, sets, clips, tracks
- `activeBrushId` / `setActiveBrush()` - Current preset for painting clips
- `toolMode` - 'paint' | 'erase' for FL Studio-style workflow
- `recentPresets` - Recently used preset IDs

### useSetPlayer
Playback engine, beat sync, DMX output
- `masterDimmer` / `setMasterDimmer()` - 0-100% global dimmer
- `applyMasterDimmer()` - Handles strobe mode (dims RGB instead of ch0)
- `isPlaying`, `play()`, `stop()`
- `activeSet` / `setActiveSet()`

### useAppMode
App state: testing vs performance mode
- `internalTempo` / `setInternalTempo()` - BPM for testing mode
- `tapTempo()` - Calculate BPM from 4 taps
- `blackout` / `toggleBlackout()`

### useUnifiedSerial
Web Serial to ESP32
- `sendDMX(channels[])` - Send 100-channel CSV to ESP32
- `audioLevels` - { bass, mid, high } from FFT (0-100)

## MIDI System

### useMIDI (`front/app/composables/useMIDI.ts`)
Web MIDI API wrapper
- `connect()` - Request MIDI access
- `devices` - Connected MIDI devices
- `lastEvent` - Most recent MIDIEvent
- Event types: `noteon`, `noteoff`, `cc`, `pitchbend`

### useMIDIMapper (`front/app/composables/useMIDIMapper.ts`)
Maps MIDI → actions, persists to localStorage

**Action Types:**
- `master:dimmer` - CC → 0-100% dimmer (smooth interpolation)
- `master:blackout` - Note → toggle blackout
- `transport:play` - Note → play/pause
- `transport:stop` - Note → stop
- `set:next` / `set:prev` - Note → navigate sets
- `set:activate` - Note → make selected set active
- `set:trigger` - Note → activate + play

**Default Mappings (QMK keyboard):**
| MIDI | Action |
|------|--------|
| CC 74, Ch1 | Master Dimmer |
| Note 72 (C5), Ch1 | Play/Pause |
| Note 73 (C#5), Ch1 | Blackout |
| Note 79 (G5), Ch1 | Prev Set |
| Note 80 (G#5), Ch1 | Next Set |
| Note 83 (B5), Ch1 | Set Active |

**Learning Mode:**
```ts
const mapper = useMIDIMapper()
mapper.startLearning((event) => {
  // event: { type: 'cc'|'note', number, channel }
  mapper.addMapping({
    name: 'My Control',
    midiType: event.type,
    midiNumber: event.number,
    channel: event.channel,
    action: { type: 'master:dimmer' }
  })
})
```

**UI:** `MIDIConfigModal.vue` - Configure mappings, learn mode

## ESP32 Firmware (`serial/dmx_beat/dmx_beat.ino`)

**Dual-core optimized:**
- Core 0: FFT audio analysis (256 samples, ~32ms)
- Core 1: Serial RX + DMX output at 44Hz

**Serial Protocol:**
- TX: `{"bass":N,"mid":N,"high":N}\n` (audio levels 0-100)
- RX: `ch1,ch2,...,ch100\n` (DMX values CSV)
- RX: `CFG:key=value\n` (config commands)

## Preset Audio Reactive
Presets can have `audioReactive` settings:
```ts
{
  enabled: boolean,
  band: 'bass' | 'mid' | 'high',
  channel: number,      // Which channel to modulate (0=dimmer, 1=R, etc)
  threshold: number,    // Gate 0-100%
  min: number,          // Output min 0-100%
  max: number,          // Output max 0-100%
  curve: 'square' | 'linear' | 'sine'
}
```

Clips with audio reactive show 🎤B/M/H indicator.

## PinSpot RGBW 5ch Profile
- Ch0: Dimmer (9-134) or Strobe (135-239)
- Ch1-4: R, G, B, W (0-255)

When strobe active, global dimmer applies to RGB channels instead of ch0.
