
CREATE TABLE public.mixing_steps (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  batch_id        UUID NOT NULL REFERENCES public.batches(id) ON DELETE CASCADE,
  step_number     INTEGER NOT NULL,
  type            TEXT NOT NULL CHECK (type IN ('add_material', 'mix_round', 'qc_check')),
  label           TEXT NOT NULL,
  display_ref     TEXT NOT NULL,
  status          TEXT NOT NULL DEFAULT 'in_progress' CHECK (status IN ('in_progress', 'completed', 'voided')),
  params          JSONB,
  operator        UUID REFERENCES public.users(id),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at    TIMESTAMPTZ,

  UNIQUE (batch_id, step_number)
);

CREATE INDEX idx_mixing_steps_batch_id ON public.mixing_steps(batch_id);
