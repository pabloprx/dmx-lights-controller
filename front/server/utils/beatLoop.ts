import { linkStore, updateLinkState } from "./linkState";

let loopInterval: ReturnType<typeof setInterval> | null = null;
let lastBeatInt = -1;

export function startBeatLoop() {
  if (loopInterval) return;

  // Poll at ~60fps for smooth beat tracking
  loopInterval = setInterval(() => {
    const link = linkStore.instance;
    if (!link || !linkStore.state.enabled) return;

    const quantum = linkStore.state.quantum;
    const beat = link.getBeat();
    const phase = link.getPhase(quantum);
    const tempo = link.getTempo();
    const isPlaying = link.isPlaying();

    // Detect beat boundaries (new whole beat number)
    const currentBeatInt = Math.floor(beat);
    const isNewBeat = currentBeatInt !== lastBeatInt;
    lastBeatInt = currentBeatInt;

    // Calculate beat in bar from beat counter (works even without transport playing)
    const beatInBar = (Math.floor(beat) % quantum) + 1;
    // Calculate bar number (0, 1, 2, 3...) for tracking position in multi-bar sets
    const barNumber = Math.floor(beat / quantum);

    updateLinkState({
      beat,
      phase,
      tempo,
      isPlaying,
      beatInBar,
      barNumber,
      lastBeatTime: isNewBeat ? Date.now() : linkStore.state.lastBeatTime,
    });
  }, 16); // ~60fps

  console.log("[BeatLoop] Started polling at 60fps");
}

export function stopBeatLoop() {
  if (loopInterval) {
    clearInterval(loopInterval);
    loopInterval = null;
    lastBeatInt = -1;
    console.log("[BeatLoop] Stopped");
  }
}

export function isLoopRunning(): boolean {
  return loopInterval !== null;
}
