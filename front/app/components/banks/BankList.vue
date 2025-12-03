<script setup lang="ts">
import { Button } from '@/components/ui/button'

const { banks, selectedBankId, activeBankId, selectBank, setActiveBank, addBank } = useDMXStore()
const { isPerformanceMode, isTestingMode } = useAppMode()
const {
  queue,
  loopCurrent,
  pendingBankId,
  addToQueue,
  playNext,
  removeFromQueue,
  scheduleSwitch,
  toggleLoop,
  getQueuePosition,
  isPending,
  isActive,
} = useBankQueue()

const showSettings = ref(false)
const editingBankId = ref<string | null>(null)

function handleAdd() {
  const bankCount = banks.value.length
  addBank({ name: `Bank ${bankCount + 1}` })
}

function handleSelect(bankId: string) {
  selectBank(bankId)
}

function handleActivate(bankId: string) {
  if (isPerformanceMode.value) {
    // In performance mode, schedule switch on next beat
    scheduleSwitch(bankId)
  } else {
    // In testing mode, toggle immediately
    setActiveBank(activeBankId.value === bankId ? null : bankId)
  }
}

function handleEdit(bankId: string) {
  editingBankId.value = bankId
  showSettings.value = true
}

function handleSettingsClose() {
  showSettings.value = false
  editingBankId.value = null
}

function handleAddToQueue(bankId: string, e: Event) {
  e.stopPropagation()
  addToQueue(bankId)
}

function handlePlayNext(bankId: string, e: Event) {
  e.stopPropagation()
  playNext(bankId)
}

function handleRemoveFromQueue(bankId: string, e: Event) {
  e.stopPropagation()
  removeFromQueue(bankId)
}
</script>

<template>
  <div class="flex flex-col gap-2 p-4 border-b border-neutral-700">
    <div class="flex justify-between items-center">
      <div class="flex items-center gap-3">
        <h3 class="text-sm font-bold text-neutral-400 uppercase">Banks</h3>

        <!-- Loop toggle (performance mode) -->
        <button
          v-if="isPerformanceMode"
          class="px-2 py-1 rounded text-xs font-bold transition-colors"
          :class="loopCurrent ? 'bg-green-600 text-white' : 'bg-neutral-700 text-neutral-400 hover:bg-neutral-600'"
          title="Loop current bank"
          @click="toggleLoop"
        >
          {{ loopCurrent ? '🔁 Loop' : '➡️ Queue' }}
        </button>
      </div>

      <Button
        v-if="isTestingMode"
        size="sm"
        class="bg-green-600 hover:bg-green-700 text-white"
        @click="handleAdd"
      >
        + Add
      </Button>
    </div>

    <!-- Queue display (performance mode) -->
    <div v-if="isPerformanceMode && queue.length > 0" class="flex items-center gap-2 text-xs text-neutral-400 bg-neutral-800 rounded p-2">
      <span class="font-bold">Queue:</span>
      <div class="flex gap-1 flex-wrap">
        <span
          v-for="(q, idx) in queue"
          :key="q.bankId"
          class="px-2 py-0.5 bg-neutral-700 rounded"
        >
          {{ idx + 1 }}. {{ banks.find(b => b.id === q.bankId)?.name || '?' }}
        </span>
      </div>
    </div>

    <div v-if="banks.length === 0" class="text-neutral-500 text-sm text-center py-4">
      No banks yet. Click + Add to create one.
    </div>

    <div v-else class="flex flex-col gap-1">
      <div
        v-for="bank in banks"
        :key="bank.id"
        class="flex items-center gap-2 p-2 rounded cursor-pointer transition-all"
        :class="[
          // Selected state (for editing)
          selectedBankId === bank.id ? 'bg-neutral-700' : 'hover:bg-neutral-800',
          // Active bank border
          isActive(bank.id) && isPerformanceMode ? 'ring-2 ring-green-500' : '',
          // Pending switch indicator
          isPending(bank.id) ? 'ring-2 ring-amber-500 animate-pulse' : '',
        ]"
        @click="handleSelect(bank.id)"
        @dblclick="handleEdit(bank.id)"
      >
        <!-- Play/Activate button -->
        <button
          class="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold transition-colors"
          :class="[
            isActive(bank.id)
              ? 'bg-green-500 text-black'
              : isPending(bank.id)
                ? 'bg-amber-500 text-black'
                : 'bg-neutral-700 text-neutral-400 hover:bg-neutral-600'
          ]"
          :title="isPerformanceMode ? 'Click to switch on next beat' : 'Click to activate'"
          @click.stop="handleActivate(bank.id)"
        >
          <template v-if="isActive(bank.id)">▶</template>
          <template v-else-if="isPending(bank.id)">⏳</template>
          <template v-else>○</template>
        </button>

        <!-- Queue position badge -->
        <div
          v-if="isPerformanceMode && getQueuePosition(bank.id) > 0"
          class="w-5 h-5 rounded-full bg-blue-600 text-white text-xs flex items-center justify-center font-bold"
        >
          {{ getQueuePosition(bank.id) }}
        </div>

        <div class="flex-1 min-w-0">
          <div class="text-sm text-white truncate">{{ bank.name }}</div>
          <div class="text-xs text-neutral-500">
            {{ bank.length }} beats, {{ bank.unitDuration }} beat/cell
          </div>
        </div>

        <!-- Performance mode actions -->
        <div v-if="isPerformanceMode && !isActive(bank.id)" class="flex items-center gap-1">
          <button
            v-if="getQueuePosition(bank.id) === -1"
            class="px-2 py-1 rounded text-xs bg-blue-600 text-white hover:bg-blue-500"
            title="Add to queue"
            @click="handleAddToQueue(bank.id, $event)"
          >
            +Q
          </button>
          <button
            v-if="getQueuePosition(bank.id) === -1"
            class="px-2 py-1 rounded text-xs bg-amber-600 text-white hover:bg-amber-500"
            title="Play next"
            @click="handlePlayNext(bank.id, $event)"
          >
            Next
          </button>
          <button
            v-if="getQueuePosition(bank.id) > 0"
            class="px-2 py-1 rounded text-xs bg-red-600 text-white hover:bg-red-500"
            title="Remove from queue"
            @click="handleRemoveFromQueue(bank.id, $event)"
          >
            ✕
          </button>
        </div>
      </div>
    </div>

    <BanksBankSettings
      v-if="showSettings && editingBankId"
      :bank-id="editingBankId"
      @close="handleSettingsClose"
    />
  </div>
</template>
