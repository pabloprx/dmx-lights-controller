<script setup lang="ts">
import { Button } from '@/components/ui/button'

const { banks, selectedBankId, activeBankId, selectBank, setActiveBank, addBank } = useDMXStore()

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
  setActiveBank(activeBankId.value === bankId ? null : bankId)
}

function handleEdit(bankId: string) {
  editingBankId.value = bankId
  showSettings.value = true
}

function handleSettingsClose() {
  showSettings.value = false
  editingBankId.value = null
}
</script>

<template>
  <div class="flex flex-col gap-2 p-4 border-b border-neutral-700">
    <div class="flex justify-between items-center">
      <h3 class="text-sm font-bold text-neutral-400 uppercase">Banks</h3>
      <Button
        size="sm"
        class="bg-green-600 hover:bg-green-700 text-white"
        @click="handleAdd"
      >
        + Add
      </Button>
    </div>

    <div v-if="banks.length === 0" class="text-neutral-500 text-sm text-center py-4">
      No banks yet. Click + Add to create one.
    </div>

    <div v-else class="flex flex-col gap-1">
      <div
        v-for="bank in banks"
        :key="bank.id"
        class="flex items-center gap-2 p-2 rounded cursor-pointer"
        :class="[
          selectedBankId === bank.id ? 'bg-neutral-700' : 'hover:bg-neutral-800',
        ]"
        @click="handleSelect(bank.id)"
        @dblclick="handleEdit(bank.id)"
      >
        <button
          class="w-6 h-6 rounded-full flex items-center justify-center text-xs"
          :class="activeBankId === bank.id ? 'bg-green-500 text-black' : 'bg-neutral-700 text-neutral-400 hover:bg-neutral-600'"
          @click.stop="handleActivate(bank.id)"
        >
          {{ activeBankId === bank.id ? '▶' : '○' }}
        </button>

        <div class="flex-1 min-w-0">
          <div class="text-sm text-white truncate">{{ bank.name }}</div>
          <div class="text-xs text-neutral-500">
            {{ bank.length }} beats, {{ bank.unitDuration }} beat/cell
          </div>
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
