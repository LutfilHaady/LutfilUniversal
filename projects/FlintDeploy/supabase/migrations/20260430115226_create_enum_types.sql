
-- Enum types for Flint Batch Traceability
CREATE TYPE batch_status AS ENUM ('InProgress', 'Released', 'OnHold', 'Quarantine', 'Scrapped');
CREATE TYPE process_run_status AS ENUM ('InProgress', 'AwaitingQC', 'Passed', 'Failed', 'Overridden');
CREATE TYPE qc_timing AS ENUM ('Startup', 'EndOfRun');
CREATE TYPE qc_method AS ENUM ('VisualManual', 'ToolEquipment');
