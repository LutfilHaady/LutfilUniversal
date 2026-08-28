export interface MaintenanceEntry {
  id: string
  equipment_id: string
  maintenance_date: string
  next_due_date: string | null
  notes: string | null
  created_at: string
}

export interface Machine {
  id: string
  equipment_code: string
  name: string
  process_id: string
  supplier_info: string | null
  is_active: boolean
  created_at: string
  process: { name: string; code: string } | null
  equipment_maintenance: MaintenanceEntry[]
}
