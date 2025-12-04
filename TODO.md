# DMX App - Future TODOs

## High Priority

### Mic Sensitivity Configuration (Advanced)
- [ ] **UI-side (DONE)**: Low/Med/High sensitivity presets in TransportBar
- [ ] **Arduino-side**: Make `bassSilence`, `midSilence`, `highSilence`, and `*Max` thresholds configurable via serial commands
  - Would require new serial protocol: `CFG:bass_min=20,bass_max=200000\n`
  - More precise control at the audio source
  - File: `serial/dmx_beat/dmx_controller.ino` (lines 30-31)

### Global Dimmers
- [ ] Master dimmer slider affecting all DMX output (0-100%)
- [ ] Apply as final multiplier before sending to serial

### Advanced Mic Binding
- [ ] Map bass/mid/high to specific channels per device
- [ ] Per-device audio reactive configuration
- [ ] Example: Device 1 responds to bass, Device 2 responds to high

## Medium Priority

### Keyboard Shortcuts
- [ ] Space: Play/Pause
- [ ] B: Toggle blackout
- [ ] 1-9: Quick select sets
- [ ] Arrow keys: Navigate timeline

### MIDI Device Support
- [ ] Use MIDI controllers for live control
- [ ] Map MIDI CC to DMX channels
- [ ] Map MIDI notes to preset triggers

## Low Priority / Nice to Have

### UI Improvements
- [ ] Set preview thumbnails
- [ ] Undo/redo for clip operations
- [ ] Copy/paste clips between beats
- [ ] Bulk edit multiple clips

### Performance
- [ ] WebSocket connection status indicator
- [ ] Reconnection logic improvements
- [ ] DMX output rate limiting options

---

*Last updated: Dec 2024*
