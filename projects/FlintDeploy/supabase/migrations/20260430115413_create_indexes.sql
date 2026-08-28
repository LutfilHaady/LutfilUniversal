
-- Genealogy / traceability queries
CREATE INDEX idx_batches_parent ON batches(parent_batch_id);
CREATE INDEX idx_batches_material ON batches(material_id);
CREATE INDEX idx_batches_status ON batches(status);
CREATE INDEX idx_batches_created_at ON batches(created_at);

-- Process run lookups
CREATE INDEX idx_process_runs_process ON process_runs(process_id);
CREATE INDEX idx_process_runs_equipment ON process_runs(equipment_id);
CREATE INDEX idx_process_runs_operator ON process_runs(operator_id);
CREATE INDEX idx_process_runs_output_batch ON process_runs(output_batch_id);
CREATE INDEX idx_process_runs_status ON process_runs(status);
CREATE INDEX idx_process_runs_start_date ON process_runs(start_date);

-- Junction table lookups
CREATE INDEX idx_run_inputs_run ON process_run_inputs(process_run_id);
CREATE INDEX idx_run_inputs_batch ON process_run_inputs(input_batch_id);
CREATE INDEX idx_run_params_run ON process_run_parameters(process_run_id);

-- QC lookups
CREATE INDEX idx_qc_results_run ON qc_check_results(process_run_id);
CREATE INDEX idx_qc_results_definition ON qc_check_results(qc_check_definition_id);
CREATE INDEX idx_qc_results_passed ON qc_check_results(passed);

-- Status change audit trail
CREATE INDEX idx_status_changes_batch ON batch_status_changes(batch_id);
CREATE INDEX idx_status_changes_at ON batch_status_changes(changed_at);

-- Maintenance lookups
CREATE INDEX idx_maintenance_equipment ON equipment_maintenance(equipment_id);
