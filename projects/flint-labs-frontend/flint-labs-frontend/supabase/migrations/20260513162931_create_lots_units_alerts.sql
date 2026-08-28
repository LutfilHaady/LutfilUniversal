
-- LOTS
CREATE TABLE lots (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  lot_number TEXT NOT NULL UNIQUE,
  category TEXT NOT NULL,
  unit_count INT NOT NULL DEFAULT 0,
  status batch_status NOT NULL DEFAULT 'Released',
  battery_type TEXT,
  storage_location TEXT,
  notes TEXT,
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT now()
);

-- UNITS (individual serialised battery products)
CREATE TABLE units (
  serial TEXT PRIMARY KEY,
  lot_id UUID NOT NULL REFERENCES lots(id) ON DELETE CASCADE,
  sub_batch_id UUID NOT NULL REFERENCES batches(id),
  created_at TIMESTAMPTZ DEFAULT now()
);

-- LOT_SUB_BATCHES (junction: which sub-batches composed this lot)
CREATE TABLE lot_sub_batches (
  lot_id UUID NOT NULL REFERENCES lots(id) ON DELETE CASCADE,
  sub_batch_id UUID NOT NULL REFERENCES batches(id),
  PRIMARY KEY (lot_id, sub_batch_id)
);

-- ALERTS
CREATE TABLE alerts (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  severity TEXT NOT NULL DEFAULT 'info',
  message TEXT NOT NULL,
  batch_id UUID REFERENCES batches(id),
  resolved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Indexes for the new tables
CREATE INDEX idx_units_lot ON units(lot_id);
CREATE INDEX idx_units_sub_batch ON units(sub_batch_id);
CREATE INDEX idx_lot_sub_batches_lot ON lot_sub_batches(lot_id);
CREATE INDEX idx_lot_sub_batches_sub ON lot_sub_batches(sub_batch_id);
CREATE INDEX idx_alerts_severity ON alerts(severity);
CREATE INDEX idx_alerts_resolved ON alerts(resolved_at);
CREATE INDEX idx_lots_status ON lots(status);
