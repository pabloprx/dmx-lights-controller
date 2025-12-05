# QMK MIDI Controller Mapping

## Hardware Layout

Your QMK keyboard sends MIDI on **Channel 1**.

### Knob
| Control | MIDI Type | Number | Range |
|---------|-----------|--------|-------|
| Encoder | CC        | 74     | 0-127 |

### Keys (24 total - 2 octaves)
| Row | Keys | Notes | MIDI Numbers |
|-----|------|-------|--------------|
| 1   | 12   | C4 - B4 | 60-71 |
| 2   | 12   | C5 - B5 | 72-83 |

```
┌────┬────┬────┬────┬────┬────┬────┬────┬────┬────┬────┬────┐
│ C4 │ C#4│ D4 │ D#4│ E4 │ F4 │ F#4│ G4 │ G#4│ A4 │ A#4│ B4 │
│ 60 │ 61 │ 62 │ 63 │ 64 │ 65 │ 66 │ 67 │ 68 │ 69 │ 70 │ 71 │
├────┼────┼────┼────┼────┼────┼────┼────┼────┼────┼────┼────┤
│ C5 │ C#5│ D5 │ D#5│ E5 │ F5 │ F#5│ G5 │ G#5│ A5 │ A#5│ B5 │
│ 72 │ 73 │ 74 │ 75 │ 76 │ 77 │ 78 │ 79 │ 80 │ 81 │ 82 │ 83 │
└────┴────┴────┴────┴────┴────┴────┴────┴────┴────┴────┴────┘
        [KNOB: CC 74]
```

---

## Mapping System

### MIDIMapping Type

```typescript
interface MIDIMapping {
  id: string
  name: string                    // User-friendly name
  midiType: 'cc' | 'note'
  midiNumber: number              // CC number or note number
  channel: number                 // MIDI channel (1-16)

  // Action to perform
  action: MIDIAction
}

type MIDIAction =
  // Transport
  | { type: 'transport:play' }
  | { type: 'transport:stop' }
  | { type: 'transport:tap-tempo' }

  // Master controls
  | { type: 'master:dimmer', scale?: [number, number] }  // CC only
  | { type: 'master:blackout' }                          // Note toggle

  // Set triggering
  | { type: 'set:trigger', setId: string }               // Note triggers set
  | { type: 'set:next' }
  | { type: 'set:prev' }

  // Direct DMX control
  | { type: 'dmx:channel', channel: number }             // CC -> DMX channel
  | { type: 'dmx:device-dimmer', deviceId: string }      // CC -> device dimmer

  // Preset triggering
  | { type: 'preset:trigger', presetId: string, deviceId?: string }

  // Scene loading
  | { type: 'scene:load', sceneId: string }
```

### Storage

Mappings stored in localStorage under `midi-mappings`:

```typescript
const mappings = ref<MIDIMapping[]>([])

// Load
const stored = localStorage.getItem('midi-mappings')
if (stored) mappings.value = JSON.parse(stored)

// Save
watch(mappings, (m) => {
  localStorage.setItem('midi-mappings', JSON.stringify(m))
}, { deep: true })
```

---

## Suggested Default Mappings

### Knob (CC 74)
| Mapping | Action |
|---------|--------|
| **Master Dimmer** | `{ type: 'master:dimmer' }` - Controls global output level |

### Row 1 (C4-B4, notes 60-71) - Set Triggers
| Key | Note | Suggested Mapping |
|-----|------|-------------------|
| C4  | 60   | Trigger Set 1 |
| C#4 | 61   | Trigger Set 2 |
| D4  | 62   | Trigger Set 3 |
| D#4 | 63   | Trigger Set 4 |
| E4  | 64   | Trigger Set 5 |
| F4  | 65   | Trigger Set 6 |
| F#4 | 66   | Trigger Set 7 |
| G4  | 67   | Trigger Set 8 |
| G#4 | 68   | Trigger Set 9 |
| A4  | 69   | Trigger Set 10 |
| A#4 | 70   | Trigger Set 11 |
| B4  | 71   | Trigger Set 12 |

### Row 2 (C5-B5, notes 72-83) - Transport & Utility
| Key | Note | Suggested Mapping |
|-----|------|-------------------|
| C5  | 72   | Play/Pause |
| C#5 | 73   | Stop |
| D5  | 74   | Tap Tempo |
| D#5 | 75   | Blackout Toggle |
| E5  | 76   | Previous Set |
| F5  | 77   | Next Set |
| F#5 | 78   | (unassigned) |
| G5  | 79   | (unassigned) |
| G#5 | 80   | (unassigned) |
| A5  | 81   | (unassigned) |
| A#5 | 82   | (unassigned) |
| B5  | 83   | (unassigned) |

---

## Implementation Checklist

### Phase 1: Core Mapping Engine
- [ ] Create `useMIDIMapper` composable
- [ ] MIDI event -> mapping lookup (by type + number + channel)
- [ ] Action executor (switch on action.type)
- [ ] Integration with `useSetPlayer`, `useDMXStore`

### Phase 2: Mapping UI
- [ ] Mapping editor page/modal
- [ ] "Learn" mode: press key -> auto-fill MIDI params
- [ ] Mapping list with edit/delete
- [ ] Import/export mappings as JSON

### Phase 3: Visual Feedback
- [ ] Show active mappings on `/midi` page
- [ ] Highlight triggered controls in main UI
- [ ] LED feedback to controller (if supported)

---

## Code Example: Action Executor

```typescript
function executeMIDIAction(action: MIDIAction, value: number) {
  const player = useSetPlayer()
  const store = useDMXStore()

  switch (action.type) {
    case 'transport:play':
      player.play()
      break

    case 'transport:stop':
      player.stop()
      break

    case 'master:dimmer':
      // Map 0-127 to 0-100
      const dimmer = Math.round((value / 127) * 100)
      player.setMasterDimmer(dimmer)
      break

    case 'master:blackout':
      if (value > 0) player.toggleBlackout()
      break

    case 'set:trigger':
      if (value > 0) {  // Note on only
        player.setActiveSet(action.setId)
        player.play()
      }
      break

    case 'set:next':
      if (value > 0) player.nextSet()
      break

    case 'set:prev':
      if (value > 0) player.prevSet()
      break

    case 'dmx:channel':
      // Direct DMX: map 0-127 to 0-255
      const dmxValue = Math.round((value / 127) * 255)
      serial.setChannel(action.channel, dmxValue)
      break
  }
}
```

---

## Notes

- All keys send velocity 127 (no velocity sensitivity)
- Knob sends continuous values, good for faders/dimmers
- Notes are momentary (NOTE ON when pressed, NOTE OFF when released)
- Consider debouncing for rapid key presses
