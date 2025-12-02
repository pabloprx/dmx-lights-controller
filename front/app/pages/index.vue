<script setup lang="ts">
import { watch } from "vue";

const { state: linkState, connected: linkConnected } = useAbletonLink();
const {
  isSupported: serialSupported,
  isConnected: serialConnected,
  isConnecting: serialConnecting,
  error: serialError,
  receivedData,
  connect: connectSerial,
  disconnect: disconnectSerial,
  sendBeat,
} = useSerial();

// Track previous beat to detect new beats
let lastBeatInt = -1;

// Send beat to Arduino when beat changes
watch(
  () => linkState.value.beat,
  (beat) => {
    const currentBeatInt = Math.floor(beat);
    if (currentBeatInt !== lastBeatInt && serialConnected.value) {
      lastBeatInt = currentBeatInt;
      sendBeat(linkState.value.beatInBar, linkState.value.tempo);
    }
  }
);
</script>

<template>
  <div class="container">
    <h1>DMX Controller</h1>

    <!-- Big Beat Number - RED when playing -->
    <div class="beat-box" :class="{ active: linkState.isPlaying }">
      {{ linkState.isPlaying ? linkState.beatInBar : '-' }}
    </div>

    <!-- Raw WS Data Table -->
    <section class="panel">
      <h2>Ableton Link (Raw WS)</h2>
      <table class="data-table">
        <tr>
          <td>WS Connected</td>
          <td :class="linkConnected ? 'green' : 'red'">{{ linkConnected }}</td>
        </tr>
        <tr>
          <td>enabled</td>
          <td>{{ linkState.enabled }}</td>
        </tr>
        <tr>
          <td>isPlaying</td>
          <td :class="linkState.isPlaying ? 'green' : 'red'">{{ linkState.isPlaying }}</td>
        </tr>
        <tr>
          <td>numPeers</td>
          <td>{{ linkState.numPeers }}</td>
        </tr>
        <tr>
          <td>tempo</td>
          <td>{{ linkState.tempo.toFixed(2) }} BPM</td>
        </tr>
        <tr>
          <td>beat</td>
          <td>{{ linkState.beat.toFixed(3) }}</td>
        </tr>
        <tr>
          <td>phase</td>
          <td>{{ linkState.phase.toFixed(3) }}</td>
        </tr>
        <tr>
          <td>beatInBar</td>
          <td class="big">{{ linkState.beatInBar }}</td>
        </tr>
        <tr>
          <td>quantum</td>
          <td>{{ linkState.quantum }}</td>
        </tr>
        <tr>
          <td>lastBeatTime</td>
          <td>{{ linkState.lastBeatTime }}</td>
        </tr>
      </table>
    </section>

    <!-- Serial Connection -->
    <section class="panel">
      <h2>Arduino / ESP32</h2>

      <div v-if="!serialSupported" class="warning">
        Web Serial API not supported. Use Chrome or Edge.
      </div>

      <div v-else>
        <table class="data-table">
          <tr>
            <td>Status</td>
            <td :class="serialConnected ? 'green' : 'red'">
              {{ serialConnected ? "Connected" : "Disconnected" }}
            </td>
          </tr>
        </table>

        <div v-if="serialError" class="error-msg">{{ serialError }}</div>

        <button
          v-if="!serialConnected"
          class="btn"
          :disabled="serialConnecting"
          @click="connectSerial()"
        >
          {{ serialConnecting ? "Connecting..." : "Connect Serial" }}
        </button>

        <button v-else class="btn btn-off" @click="disconnectSerial()">
          Disconnect
        </button>

        <div v-if="serialConnected && receivedData" class="serial-log">
          <div class="label">Arduino Output:</div>
          <pre>{{ receivedData }}</pre>
        </div>
      </div>
    </section>
  </div>
</template>

<style scoped>
* {
  transition: none !important;
  animation: none !important;
}

.container {
  max-width: 600px;
  margin: 0 auto;
  padding: 20px;
  font-family: monospace;
  color: #fff;
  background: #000;
  min-height: 100vh;
}

h1 {
  text-align: center;
  margin-bottom: 20px;
}

h2 {
  margin: 0 0 10px;
  font-size: 14px;
  color: #888;
}

.beat-box {
  width: 200px;
  height: 200px;
  margin: 0 auto 20px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 120px;
  font-weight: bold;
  background: #222;
  color: #444;
}

.beat-box.active {
  background: #f00;
  color: #fff;
}

.panel {
  background: #111;
  border: 1px solid #333;
  padding: 15px;
  margin-bottom: 15px;
}

.data-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 14px;
}

.data-table td {
  padding: 6px 8px;
  border-bottom: 1px solid #222;
}

.data-table td:first-child {
  color: #888;
}

.data-table td:last-child {
  text-align: right;
  font-family: monospace;
}

.big {
  font-size: 24px;
  font-weight: bold;
}

.green {
  color: #0f0;
}

.red {
  color: #f00;
}

.btn {
  width: 100%;
  padding: 12px;
  border: none;
  font-family: monospace;
  font-size: 14px;
  cursor: pointer;
  background: #0f0;
  color: #000;
  margin-top: 10px;
}

.btn:disabled {
  background: #333;
  color: #666;
  cursor: not-allowed;
}

.btn-off {
  background: #333;
  color: #fff;
}

.warning {
  background: #330;
  color: #fa0;
  padding: 10px;
  text-align: center;
}

.error-msg {
  color: #f00;
  margin: 10px 0;
}

.serial-log {
  margin-top: 10px;
}

.serial-log .label {
  color: #888;
  margin-bottom: 5px;
}

.serial-log pre {
  background: #000;
  border: 1px solid #333;
  padding: 10px;
  font-size: 12px;
  max-height: 100px;
  overflow-y: auto;
  white-space: pre-wrap;
  word-break: break-all;
  margin: 0;
}
</style>
