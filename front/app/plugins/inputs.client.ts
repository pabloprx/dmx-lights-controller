// Activate the input layer once, app-wide, on the client.
// This keeps MIDI + gamepad mappers alive regardless of which component is
// mounted (previously the watcher died if the first-mounting component unmounted).
export default defineNuxtPlugin(() => {
  // Gamepad needs no permission - start polling immediately.
  useGamepadMapper()

  // MIDI: requestMIDIAccess({sysex:false}) generally does not prompt in Chrome.
  const midi = useMIDI()
  midi.connect().catch(() => {})
  useMIDIMapper()
})
