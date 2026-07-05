# DMX Lights Controller

A DMX stage-lights controller for live performance. It sequences RGBW PinSpot
fixtures over an ESP32, syncs to the beat, and reacts to audio, with a 3D stage
visualizer so you can build and rehearse shows with no hardware plugged in.

## Stack

- `front/`: Nuxt 4, Vue 3, TypeScript. This is the app you run and modify.
- `serial/dmx_beat/`: ESP32 Arduino firmware (FFT audio analysis + DMX output).
  Stable and frozen. Keep contributions frontend-only unless you know exactly
  what you are doing.

## Hardware

- An ESP32 connected over Web Serial. You need Chrome or Edge: Web Serial is not
  in Firefox or Safari.
- The ESP32 drives RGBW PinSpot fixtures on a 5-channel profile:
  - ch0: dimmer (9-134) or strobe (135-239)
  - ch1-4: R, G, B, W (0-255)
- The ESP32 also runs an FFT and streams audio levels (bass/mid/high) back to the
  app, which drives audio-reactive presets.
- No hardware is required to work: the 3D stage visualizer renders the same output
  the fixtures would show.

### Serial protocol

- TX to ESP32: one CSV line of 100 DMX channel values, `ch1,ch2,...,ch100`.
- RX from ESP32: audio levels as JSON lines, `{"bass":N,"mid":N,"high":N}`.
- Config: `CFG:key=value` command lines.

## Quickstart

```sh
cd front
npm install
npm run dev
```

The dev server runs on port **3010** (not 3000). Open it in Chrome or Edge, then
connect the ESP32 from the controller UI.

Other commands (run from `front/`):

```sh
npx vitest run   # unit tests
npx nuxt build   # production build
```

Note: `nuxt typecheck` has pre-existing errors and is not used as a gate. Gate on
build + vitest instead.

## Pages

- `/` redirects to the controller: the controller is the app.
- `/controller`: the live perform view. Set list, transport, master controls,
  visualizer, gamepad/MIDI performance.
- `/dmx`: manual DMX test bench with quick presets.
- `/mic`: live audio levels coming back from the ESP32 FFT.
- `/midi`: MIDI device view and mapping config with learn mode.
- `/diagnostics`: ESP32 serial and Ableton Link status plus hardware tools.

## Features

- Clip/track set sequencer on a sub-beat (1/4) grid.
- Curated VJ set packs: a core library (Intro / Buildup / Drop / FX), a
  Garrix-style show pack, and a Techno pack sized for ~122 bpm.
- Beat sync from an internal tap tempo or from Ableton Link (a small WebSocket
  bridge lives in `front/server`).
- Gamepad performance controls (PlayStation-style pad): D-pad browses sets by
  section, face/shoulder buttons fire FX pads and holds, L3 reverses playback,
  Share taps the tempo.
- MIDI mapping with learn mode: dimmer, blackout, transport, set navigation.
- Master dimmer, blackout, and strobe.
- Audio-reactive presets driven by the ESP32 FFT.
- 3D stage visualizer and a diagnostics page.

## How it hangs together

Layered so the tricky logic stays pure and testable:

- `front/app/lib/`: pure logic, no framework. Beat math, clip math, MIDI/pad
  math, VJ set packs, serial pump, stage scene. Unit-tested with Vitest in
  `front/test/`.
- `front/app/composables/`: state and orchestration.
  - `useDMXStore`: central state (devices, presets, sets, clips, tracks).
  - `useSetPlayer`: playback engine, beat sync, DMX output.
  - `useUnifiedSerial`: the ESP32 link.
  - `useInputActions` / `useGamepadMapper` / `useMIDIMapper`: input mapping.
  - `useFxPads`: pad overlays composited over the base set.
- `front/app/pages/` and `front/app/components/`: the UI.

One invariant to know before you touch sequencing: playback always samples on a
fixed 1/4-beat grid. A clip whose `startBeat` or `duration` is not a multiple of
`0.25` never fires. The tests enforce this, so keep clip timings on the grid.

## Venue and fixture note

Sets are built for a rig of 6 RGBW PinSpots. Tracks bind to fixtures by DMX
address: devices are sorted by their DMX start channel, so fixture N is the Nth
pinspot in that order.
