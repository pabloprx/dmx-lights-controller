import { linkStore, updateLinkState } from "../utils/linkState";
import { startBeatLoop, stopBeatLoop } from "../utils/beatLoop";

// Try to load abletonlink - it's optional (won't build on Linux/Docker)
let AbletonLink: any = null;
try {
  AbletonLink = require("@ktamas77/abletonlink").AbletonLink;
} catch (e) {
  console.log("[AbletonLink] Native module not available - running without Link sync");
}

export default defineNitroPlugin((nitroApp) => {
  // If abletonlink isn't available, just start the beat loop with internal timing
  if (!AbletonLink) {
    console.log("[AbletonLink] Running in standalone mode (no Link sync)");
    startBeatLoop();
    return;
  }

  console.log("[AbletonLink] Initializing...");

  // Create Link instance with default 120 BPM
  const link = new AbletonLink(120.0);
  linkStore.instance = link;

  // Enable Link
  link.enable(true);
  link.enableStartStopSync(true);

  updateLinkState({
    enabled: true,
    tempo: link.getTempo(),
    numPeers: link.getNumPeers(),
  });

  console.log("[AbletonLink] Enabled with tempo:", link.getTempo(), "BPM");

  // Set up callbacks
  link.setNumPeersCallback((numPeers: number) => {
    console.log("[AbletonLink] Peers changed:", numPeers);
    updateLinkState({ numPeers });
  });

  link.setTempoCallback((tempo: number) => {
    console.log("[AbletonLink] Tempo changed:", tempo.toFixed(2), "BPM");
    updateLinkState({ tempo });
  });

  link.setStartStopCallback((isPlaying: boolean) => {
    console.log("[AbletonLink] Transport:", isPlaying ? "PLAYING" : "STOPPED");
    updateLinkState({ isPlaying });
  });

  // Start the beat polling loop
  startBeatLoop();

  // Cleanup on server close
  nitroApp.hooks.hook("close", () => {
    console.log("[AbletonLink] Shutting down...");
    stopBeatLoop();
    link.enable(false);
    linkStore.instance = null;
  });

  console.log("[AbletonLink] Ready! Waiting for Rekordbox with Link enabled...");
});
