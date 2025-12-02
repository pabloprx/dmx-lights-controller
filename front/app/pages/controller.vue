<script setup lang="ts">
import TransportBar from '~/components/transport/TransportBar.vue'

const activeTab = ref<'fixtures' | 'presets' | 'scenes' | 'banks'>('banks')

const tabs = [
  { id: 'fixtures' as const, label: 'Fixtures' },
  { id: 'presets' as const, label: 'Presets' },
  { id: 'scenes' as const, label: 'Scenes' },
  { id: 'banks' as const, label: 'Banks' },
]
</script>

<template>
  <div class="flex flex-col h-screen bg-neutral-950 text-white">
    <TransportBar />

    <div class="flex border-b border-neutral-700">
      <button
        v-for="tab in tabs"
        :key="tab.id"
        class="px-6 py-3 text-sm font-medium transition-colors"
        :class="activeTab === tab.id
          ? 'text-green-400 border-b-2 border-green-400 bg-neutral-900'
          : 'text-neutral-400 hover:text-white hover:bg-neutral-800'"
        @click="activeTab = tab.id"
      >
        {{ tab.label }}
      </button>
    </div>

    <div class="flex-1 overflow-hidden">
      <FixturesFixtureList v-if="activeTab === 'fixtures'" />

      <PresetsPresetList v-if="activeTab === 'presets'" />

      <ScenesSceneList v-if="activeTab === 'scenes'" />

      <div v-if="activeTab === 'banks'" class="flex flex-col h-full">
        <BanksBankList />
        <div class="flex-1 p-4 overflow-y-auto">
          <BanksBankGrid />
        </div>
      </div>
    </div>
  </div>
</template>
