import { ref } from "vue";

export interface LinkState {
  enabled: boolean;
  tempo: number;
  beat: number;
  phase: number;
  isPlaying: boolean;
  numPeers: number;
  quantum: number;
  lastBeatTime: number;
  beatInBar: number;
  barNumber: number;
}

// ── Module singleton ──────────────────────────────────────────────
// One WebSocket + one state for the whole app. This composable is called from
// MANY places (useSetPlayer in every component, input dispatchers, module-scope
// singletons); per-call state meant each caller had its OWN `connected`/`state`
// refs, so Link looked connected in one component and disconnected everywhere
// else (and beat computations disagreed). It also registered onUnmounted from
// non-setup contexts (Vue warning). Singleton + no lifecycle hooks fixes both;
// the socket is page-lifetime, disconnect stays manual.
const state = ref<LinkState>({
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
});

const connected = ref(false);
const error = ref<string | null>(null);

let ws: WebSocket | null = null;
let reconnectTimeout: ReturnType<typeof setTimeout> | null = null;

function connect() {
  if (ws?.readyState === WebSocket.OPEN) return;

  const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
  const url = `${protocol}//${window.location.host}/_ws`;

  ws = new WebSocket(url);

  ws.onopen = () => {
    connected.value = true;
    error.value = null;
    console.log("[AbletonLink] WebSocket connected");
  };

  ws.onmessage = (event) => {
    try {
      const msg = JSON.parse(event.data);
      if (msg.type === "state") {
        state.value = msg.data;
      }
    } catch (e) {
      console.error("[AbletonLink] Failed to parse message:", e);
    }
  };

  ws.onclose = () => {
    connected.value = false;
    console.log("[AbletonLink] WebSocket disconnected, reconnecting...");
    scheduleReconnect();
  };

  ws.onerror = (e) => {
    error.value = "WebSocket error";
    console.error("[AbletonLink] WebSocket error:", e);
  };
}

function disconnect() {
  if (reconnectTimeout) {
    clearTimeout(reconnectTimeout);
    reconnectTimeout = null;
  }
  if (ws) {
    // Neutralize onclose so a manual disconnect doesn't schedule a reconnect.
    ws.onclose = null;
    ws.close();
    ws = null;
  }
  connected.value = false;
}

function scheduleReconnect() {
  if (reconnectTimeout) return;
  reconnectTimeout = setTimeout(() => {
    reconnectTimeout = null;
    connect();
  }, 2000);
}

export function useAbletonLink() {
  return {
    state,
    connected,
    error,
    connect,
    disconnect,
  };
}
