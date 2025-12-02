import { subscribeLinkState, getLinkState, type LinkState } from "../utils/linkState";

export default defineWebSocketHandler({
  open(peer) {
    console.log("[WebSocket] Client connected:", peer.id);

    // Send initial state immediately
    peer.send(JSON.stringify({
      type: "state",
      data: getLinkState(),
    }));

    // Subscribe to state updates
    const unsubscribe = subscribeLinkState((state: LinkState) => {
      try {
        peer.send(JSON.stringify({
          type: "state",
          data: state,
        }));
      } catch {
        // Client disconnected
      }
    });

    // Store unsubscribe function for cleanup
    (peer as any)._unsubscribe = unsubscribe;
  },

  message(peer, message) {
    // Handle incoming messages if needed
    console.log("[WebSocket] Message from", peer.id, ":", message.text());
  },

  close(peer) {
    console.log("[WebSocket] Client disconnected:", peer.id);

    // Clean up subscription
    const unsubscribe = (peer as any)._unsubscribe;
    if (unsubscribe) {
      unsubscribe();
    }
  },

  error(peer, error) {
    console.error("[WebSocket] Error for", peer.id, ":", error);
  },
});
