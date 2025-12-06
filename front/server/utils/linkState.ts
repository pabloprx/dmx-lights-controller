// AbletonLink instance type (optional - may not be available on all platforms)
interface AbletonLinkInstance {
  enable(enabled: boolean): void;
  enableStartStopSync(enabled: boolean): void;
  getTempo(): number;
  setTempo(tempo: number): void;
  getNumPeers(): number;
  getBeat(): number;
  getPhase(): number;
  isPlaying(): boolean;
  setNumPeersCallback(cb: (numPeers: number) => void): void;
  setTempoCallback(cb: (tempo: number) => void): void;
  setStartStopCallback(cb: (isPlaying: boolean) => void): void;
}

export interface LinkState {
  enabled: boolean;
  tempo: number;
  beat: number;
  phase: number;
  isPlaying: boolean;
  numPeers: number;
  quantum: number;
  lastBeatTime: number;
  beatInBar: number; // 1-4 for 4/4 time
  barNumber: number; // 0, 1, 2, 3... (which bar we're in)
}

export interface LinkStore {
  instance: AbletonLinkInstance | null;
  state: LinkState;
  subscribers: Set<(state: LinkState) => void>;
}

// Shared singleton store for Ableton Link state
export const linkStore: LinkStore = {
  instance: null,
  state: {
    enabled: false,
    tempo: 120,
    beat: 0,
    phase: 0,
    isPlaying: false,
    numPeers: 0,
    quantum: 4,
    lastBeatTime: 0,
    beatInBar: 1,
    barNumber: 0,
  },
  subscribers: new Set(),
};

export function updateLinkState(partial: Partial<LinkState>) {
  Object.assign(linkStore.state, partial);

  // beatInBar is now calculated directly in beatLoop.ts from the beat counter
  // This works even when Link transport isn't playing

  // Notify subscribers
  for (const callback of linkStore.subscribers) {
    callback(linkStore.state);
  }
}

export function subscribeLinkState(callback: (state: LinkState) => void) {
  linkStore.subscribers.add(callback);
  return () => linkStore.subscribers.delete(callback);
}

export function getLinkState(): LinkState {
  return { ...linkStore.state };
}

export function getLinkInstance(): AbletonLinkInstance | null {
  return linkStore.instance;
}
