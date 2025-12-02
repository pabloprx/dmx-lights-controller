import type { AbletonLink } from "@ktamas77/abletonlink";

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
}

export interface LinkStore {
  instance: AbletonLink | null;
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
  },
  subscribers: new Set(),
};

export function updateLinkState(partial: Partial<LinkState>) {
  Object.assign(linkStore.state, partial);

  // Calculate beat in bar (1-4 for 4/4 time)
  if (partial.phase !== undefined) {
    linkStore.state.beatInBar = Math.floor(partial.phase) + 1;
  }

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

export function getLinkInstance(): AbletonLink | null {
  return linkStore.instance;
}
