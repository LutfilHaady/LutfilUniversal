-- Sprint 9 J2 — GAP-09 backend: Low-stock alert rule
-- Note: materials.min_storage_threshold already exists and serves the same
-- purpose as the spec's "minimum_stock" column. No redundant column added.
-- Sprint 10 frontend should read materials.min_storage_threshold for low-stock
-- comparisons, and add the scanAlerts() builder for the 'low_stock' rule key.

INSERT INTO public.alert_rules (key, label, enabled, severity, threshold)
VALUES ('low_stock', 'Material below minimum stock level', true, 'warning', NULL)
ON CONFLICT (key) DO NOTHING;
