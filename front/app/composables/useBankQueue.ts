// Bank Queue - Spotify-like playlist for performance mode
// - Loop current bank (default)
// - Queue banks to play next
// - Beat-synced transitions (always switch on beat boundary)

export interface QueuedBank {
  bankId: string
  addedAt: number
}

const queue = ref<QueuedBank[]>([])
const loopCurrent = ref(true)
const pendingBankId = ref<string | null>(null) // Bank scheduled to switch on next beat

export function useBankQueue() {
  const { activeBank, setActiveBank, banks } = useDMXStore()
  const { isPerformanceMode } = useAppMode()

  // Add bank to end of queue
  function addToQueue(bankId: string) {
    // Don't add if already in queue
    if (queue.value.some(q => q.bankId === bankId)) return
    queue.value.push({ bankId, addedAt: Date.now() })
  }

  // Add bank to play next (front of queue)
  function playNext(bankId: string) {
    // Remove if already in queue
    queue.value = queue.value.filter(q => q.bankId !== bankId)
    queue.value.unshift({ bankId, addedAt: Date.now() })
  }

  // Remove from queue
  function removeFromQueue(bankId: string) {
    queue.value = queue.value.filter(q => q.bankId !== bankId)
  }

  // Clear entire queue
  function clearQueue() {
    queue.value = []
  }

  // Move bank up in queue
  function moveUp(bankId: string) {
    const idx = queue.value.findIndex(q => q.bankId === bankId)
    if (idx > 0) {
      const item = queue.value.splice(idx, 1)[0]
      queue.value.splice(idx - 1, 0, item)
    }
  }

  // Move bank down in queue
  function moveDown(bankId: string) {
    const idx = queue.value.findIndex(q => q.bankId === bankId)
    if (idx >= 0 && idx < queue.value.length - 1) {
      const item = queue.value.splice(idx, 1)[0]
      queue.value.splice(idx + 1, 0, item)
    }
  }

  // Schedule a bank to switch on next beat (quick jump)
  function scheduleSwitch(bankId: string) {
    if (!isPerformanceMode.value) {
      // In testing mode, switch immediately
      setActiveBank(bankId)
      return
    }
    pendingBankId.value = bankId
  }

  // Execute the pending switch (called by useBankPlayer on beat boundary)
  function executePendingSwitch(): boolean {
    if (!pendingBankId.value) return false

    setActiveBank(pendingBankId.value)
    // Remove from queue if it was queued
    removeFromQueue(pendingBankId.value)
    pendingBankId.value = null
    return true
  }

  // Get next bank from queue (called when current bank ends and not looping)
  function popNextFromQueue(): string | null {
    if (queue.value.length === 0) return null
    const next = queue.value.shift()
    return next?.bankId || null
  }

  // Toggle loop mode
  function toggleLoop() {
    loopCurrent.value = !loopCurrent.value
  }

  // Get queue position for a bank (for UI display)
  function getQueuePosition(bankId: string): number {
    const idx = queue.value.findIndex(q => q.bankId === bankId)
    return idx >= 0 ? idx + 1 : -1
  }

  // Check if bank is pending switch
  function isPending(bankId: string): boolean {
    return pendingBankId.value === bankId
  }

  // Check if bank is currently active
  function isActive(bankId: string): boolean {
    return activeBank.value?.id === bankId
  }

  return {
    // State
    queue: readonly(queue),
    loopCurrent,
    pendingBankId: readonly(pendingBankId),

    // Actions
    addToQueue,
    playNext,
    removeFromQueue,
    clearQueue,
    moveUp,
    moveDown,
    scheduleSwitch,
    executePendingSwitch,
    popNextFromQueue,
    toggleLoop,

    // Helpers
    getQueuePosition,
    isPending,
    isActive,
  }
}
