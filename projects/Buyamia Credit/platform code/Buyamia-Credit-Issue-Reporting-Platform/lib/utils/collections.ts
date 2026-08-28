// InvoiceStatus type matches the schema string values
type InvoiceStatus = 'PENDING' | 'PAID' | 'DUE_SOON' | 'OVERDUE_3' | 'OVERDUE_7' | 'DEFAULTED'

/**
 * Calculate days overdue or days until due
 * @param dueDate - The invoice due date
 * @returns Object with daysOverdue (0 or positive) and daysUntilDue (0 or positive)
 */
export function calculateDaysOverdue(dueDate: Date | string): {
  daysOverdue: number
  daysUntilDue: number
} {
  const now = new Date()
  const due = typeof dueDate === 'string' ? new Date(dueDate) : dueDate
  
  // Reset time to midnight for accurate day calculation
  const nowMidnight = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const dueMidnight = new Date(due.getFullYear(), due.getMonth(), due.getDate())
  
  const diffMs = nowMidnight.getTime() - dueMidnight.getTime()
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24))
  
  if (diffDays > 0) {
    return {
      daysOverdue: diffDays,
      daysUntilDue: 0,
    }
  } else {
    return {
      daysOverdue: 0,
      daysUntilDue: Math.abs(diffDays),
    }
  }
}

/**
 * Determine if an invoice needs collection based on timing
 * Returns the collection milestone (T-3, T-1, T+0, T+1, T+3, T+7)
 */
export function getCollectionMilestone(daysUntilDue: number, daysOverdue: number): string {
  if (daysUntilDue === 3) return 'T-3'
  if (daysUntilDue === 1) return 'T-1'
  if (daysOverdue === 0) return 'T+0'
  if (daysOverdue === 1) return 'T+1'
  if (daysOverdue === 3) return 'T+3'
  if (daysOverdue === 7) return 'T+7'
  
  // Default milestones
  if (daysUntilDue > 0) return `T-${daysUntilDue}`
  return `T+${daysOverdue}`
}

/**
 * Determine if an invoice should receive collection attempt
 * Based on the collection timeline from the plan
 * 
 * @param daysUntilDue - Days until due date (positive number)
 * @param daysOverdue - Days past due date (positive number)
 * @param lastCollectionAttempt - Last collection attempt date (null if never attempted)
 * @param status - Current invoice status
 * @param currentMilestone - Current milestone (T-3, T-1, T+0, etc.) - optional, will be calculated if not provided
 * @returns true if collection should be triggered for this specific milestone
 */
export function shouldTriggerCollection(
  daysUntilDue: number,
  daysOverdue: number,
  lastCollectionAttempt: Date | null,
  status: InvoiceStatus,
  currentMilestone?: string
): boolean {
  // Don't collect if already paid
  if (status === 'PAID') return false
  
  // Don't collect if defaulted (handled separately)
  if (status === 'DEFAULTED') return false
  
  // Calculate current milestone
  const milestone = currentMilestone || getCollectionMilestone(daysUntilDue, daysOverdue)
  
  // Check if we're at a valid milestone
  const validMilestones = ['T-3', 'T-1', 'T+0', 'T+1', 'T+3', 'T+7']
  if (!validMilestones.includes(milestone)) {
    return false
  }
  
  // If no previous attempt, we can send for this milestone
  if (!lastCollectionAttempt) {
    return true
  }
  
  // Check if an attempt was made today for this milestone
  // Since milestones are specific days, we only send once per milestone day
  const now = new Date()
  const lastAttemptDate = new Date(lastCollectionAttempt)
  
  // Reset both to midnight for day comparison
  const nowMidnight = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const lastAttemptMidnight = new Date(lastAttemptDate.getFullYear(), lastAttemptDate.getMonth(), lastAttemptDate.getDate())
  
  // If last attempt was today, don't send again (prevents duplicate sends on same day)
  // This allows sending different milestones on different days
  if (nowMidnight.getTime() === lastAttemptMidnight.getTime()) {
    return false
  }
  
  // If last attempt was on a different day, we can send for this milestone
  return true
}

/**
 * Determine collection attempt type based on timing
 * Returns: 'whatsapp_message' only (calls disabled per requirements)
 */
export function determineAttemptType(
  daysUntilDue: number,
  daysOverdue: number
): 'whatsapp_message' | 'whatsapp_call' | 'both' {
  // WhatsApp messages only - no calls
  return 'whatsapp_message'
}

/**
 * Check if invoice status matches collection status
 */
export function shouldCollectBasedOnStatus(status: InvoiceStatus): boolean {
  const collectableStatuses: InvoiceStatus[] = [
    'PENDING',
    'DUE_SOON',
    'OVERDUE_3',
    'OVERDUE_7',
  ]
  
  return collectableStatuses.includes(status)
}

