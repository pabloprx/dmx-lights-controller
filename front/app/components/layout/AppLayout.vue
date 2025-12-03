<script setup lang="ts">
const props = defineProps<{
  leftPanelCollapsed?: boolean
  rightPanelCollapsed?: boolean
}>()

const emit = defineEmits<{
  'update:leftPanelCollapsed': [value: boolean]
  'update:rightPanelCollapsed': [value: boolean]
}>()

const leftCollapsed = ref(props.leftPanelCollapsed ?? false)
const rightCollapsed = ref(props.rightPanelCollapsed ?? false)

function toggleLeft() {
  leftCollapsed.value = !leftCollapsed.value
  emit('update:leftPanelCollapsed', leftCollapsed.value)
}

function toggleRight() {
  rightCollapsed.value = !rightCollapsed.value
  emit('update:rightPanelCollapsed', rightCollapsed.value)
}
</script>

<template>
  <div class="app-layout">
    <!-- Left Panel -->
    <aside
      class="panel panel-left"
      :class="{ collapsed: leftCollapsed }"
    >
      <div class="panel-content">
        <slot name="left" />
      </div>
      <button
        class="panel-toggle panel-toggle-left"
        @click="toggleLeft"
      >
        <span class="toggle-icon">{{ leftCollapsed ? '›' : '‹' }}</span>
      </button>
    </aside>

    <!-- Main Content -->
    <main class="main-content">
      <slot />
    </main>

    <!-- Right Panel -->
    <aside
      class="panel panel-right"
      :class="{ collapsed: rightCollapsed }"
    >
      <button
        class="panel-toggle panel-toggle-right"
        @click="toggleRight"
      >
        <span class="toggle-icon">{{ rightCollapsed ? '‹' : '›' }}</span>
      </button>
      <div class="panel-content">
        <slot name="right" />
      </div>
    </aside>
  </div>
</template>

<style scoped>
/* ═══════════════════════════════════════════════════════════
   NEON STUDIO - App Layout
   ═══════════════════════════════════════════════════════════ */

.app-layout {
  display: flex;
  height: 100%;
  width: 100%;
  overflow: hidden;
  background: var(--background);
}

.panel {
  display: flex;
  background: var(--card);
  transition: width 0.2s ease, min-width 0.2s ease;
  position: relative;
}

.panel-left {
  width: 240px;
  min-width: 240px;
  flex-direction: row;
  /* Neon glow border */
  border-right: 1px solid #22c55e30;
  box-shadow:
    1px 0 0 #22c55e20,
    2px 0 20px #22c55e10,
    inset -1px 0 0 #22c55e10;
}

.panel-right {
  width: 280px;
  min-width: 280px;
  flex-direction: row-reverse;
  /* Neon glow border */
  border-left: 1px solid #22c55e30;
  box-shadow:
    -1px 0 0 #22c55e20,
    -2px 0 20px #22c55e10,
    inset 1px 0 0 #22c55e10;
}

.panel.collapsed {
  width: 0;
  min-width: 0;
}

.panel.collapsed .panel-content {
  opacity: 0;
  pointer-events: none;
}

.panel-content {
  flex: 1;
  overflow: hidden;
  display: flex;
  flex-direction: column;
  transition: opacity 0.15s ease;
}

.panel-toggle {
  position: absolute;
  top: 50%;
  transform: translateY(-50%);
  width: 20px;
  height: 48px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: #22232b;
  border: 1px solid #383944;
  cursor: pointer;
  z-index: 10;
  transition: all 0.2s ease;
}

.panel-toggle:hover {
  background: #2a2b35;
  border-color: #22c55e40;
  box-shadow: 0 0 15px #22c55e20;
}

.panel-toggle-left {
  right: -20px;
  border-left: none;
  border-radius: 0 4px 4px 0;
}

.panel-toggle-right {
  left: -20px;
  border-right: none;
  border-radius: 4px 0 0 4px;
}

.toggle-icon {
  font-size: 14px;
  font-weight: bold;
  color: #8888a0;
  transition: color 0.2s ease;
}

.panel-toggle:hover .toggle-icon {
  color: #22c55e;
}

.main-content {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  min-width: 0;
  background: var(--background);
}
</style>
