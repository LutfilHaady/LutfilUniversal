-- ============================================================
-- Flint Batch Traceability — reference seed data
-- ============================================================
-- Captured from the source project (pewrwrqituidyxhfsner) on 2026-06-03.
-- Run automatically by `supabase db reset`, or apply manually after
-- `supabase db push` into a fresh project.
--
-- This seeds only the LOOKUP / REFERENCE tables the app needs to function:
--   roles, processes, materials, qc_check_definitions, role_permissions.
-- UUIDs are preserved from the source project on purpose — the role IDs
-- below match the test-account SQL in docs/FLINT_REFERENCE_21052026.md §13.
--
-- NOT seeded here (do these separately):
--   • equipment            — seeded below (23 machines, confirmed 2026-06-05)
--   • test auth users       — see docs/FLINT_REFERENCE_21052026.md §13/§14
--                             (the 3-step auth.users insert has GoTrue quirks)
--   • transactional data    — batches, process_runs, qc_check_results, lots,
--                             units, alerts, mixing_steps (intentionally empty)
-- ============================================================

-- Roles
INSERT INTO roles (id, name, description) VALUES ('3468ba22-bc4e-446a-8539-70f4a53d1023'::uuid, 'Operator', 'Scan QR, log process runs, view batch status and work history');
INSERT INTO roles (id, name, description) VALUES ('752526b8-12e7-44fb-98f1-4fbef368ae82'::uuid, 'Engineer', 'All operator permissions plus override QC, set batch status, create recipes, view dashboard, run genealogy, export reports');
INSERT INTO roles (id, name, description) VALUES ('bdc93b0a-fb76-4498-a2e9-83bc7dc72ddf'::uuid, 'Admin', 'Manage users and roles, add/edit/deactivate equipment, access audit log, configure process steps');

-- Processes
INSERT INTO processes (id, code, name, requires_calibration, sequence_hint) VALUES ('4f249480-13e2-4f73-853e-df60627f7acd'::uuid, 'UTPC', 'Assembly', 'f', '10');
INSERT INTO processes (id, code, name, requires_calibration, sequence_hint) VALUES ('57050fa3-b8b9-421e-9d8a-17ca9793d584'::uuid, 'DICC', 'Die Cutting (Cathode)', 'f', '5');
INSERT INTO processes (id, code, name, requires_calibration, sequence_hint) VALUES ('655f214e-e452-4c6e-9d7e-214baa3f33da'::uuid, 'DICA', 'Die Cutting (Anode)', 'f', '6');
INSERT INTO processes (id, code, name, requires_calibration, sequence_hint) VALUES ('81f4c276-5608-42c9-a42a-068aab14ba38'::uuid, 'SLTS', 'Slitting (Separator)', 't', '8');
INSERT INTO processes (id, code, name, requires_calibration, sequence_hint) VALUES ('8c028b13-2407-474b-ac43-93d83912b9dd'::uuid, 'CTGC', 'Coating & Oven Drying', 't', '3');
INSERT INTO processes (id, code, name, requires_calibration, sequence_hint) VALUES ('a1ddf202-3fe4-4e7b-b13f-5f7b1515bf71'::uuid, 'CALC', 'Calendaring', 't', '4');
INSERT INTO processes (id, code, name, requires_calibration, sequence_hint) VALUES ('a971751f-ceec-4738-be6c-8249c0ccf45c'::uuid, 'MIXE', 'Mixing (Electrolyte)', 'f', '2');
INSERT INTO processes (id, code, name, requires_calibration, sequence_hint) VALUES ('b5c17071-a20f-4ba2-b53e-6dd1b98c1946'::uuid, 'MIXC', 'Mixing (Cathode)', 'f', '1');
INSERT INTO processes (id, code, name, requires_calibration, sequence_hint) VALUES ('c5895fd9-86a4-4324-96fc-dfb505889f80'::uuid, 'CUTS', 'Cutting (Separator)', 'f', '7');
INSERT INTO processes (id, code, name, requires_calibration, sequence_hint) VALUES ('da5118c4-48a9-409f-a51f-fdcfaed97493'::uuid, 'SLTC', 'Slitting (Casing)', 't', '9');

-- Materials
INSERT INTO materials (id, code, name, type, shelf_life_days, min_storage_threshold, first_process_id) VALUES ('1aeee8ac-17e4-43a3-980b-65b1f02f2de6'::uuid, 'MTC1', 'Material C1', 'Cathode Electrode', NULL, NULL, 'b5c17071-a20f-4ba2-b53e-6dd1b98c1946'::uuid);
INSERT INTO materials (id, code, name, type, shelf_life_days, min_storage_threshold, first_process_id) VALUES ('60443d95-803f-4e62-80f6-8450ca2c4fc5'::uuid, 'MTC3', 'Material C3', 'Cathode Electrode', NULL, NULL, 'b5c17071-a20f-4ba2-b53e-6dd1b98c1946'::uuid);
INSERT INTO materials (id, code, name, type, shelf_life_days, min_storage_threshold, first_process_id) VALUES ('6687b7b3-3067-45bb-87a7-ca720680a57e'::uuid, 'MTDW', 'DI Water', 'Cathode Electrode', NULL, NULL, 'b5c17071-a20f-4ba2-b53e-6dd1b98c1946'::uuid);
INSERT INTO materials (id, code, name, type, shelf_life_days, min_storage_threshold, first_process_id) VALUES ('9267090e-c70b-434e-914b-9282dd93e5da'::uuid, 'MTE3', 'Material E3', 'Electrolyte', NULL, NULL, 'a971751f-ceec-4738-be6c-8249c0ccf45c'::uuid);
INSERT INTO materials (id, code, name, type, shelf_life_days, min_storage_threshold, first_process_id) VALUES ('9dc029ae-4515-4450-9c2f-5a4a6ec8e8dc'::uuid, 'MTAR', 'Roll A (Anode)', 'Anode Electrode', NULL, NULL, '655f214e-e452-4c6e-9d7e-214baa3f33da'::uuid);
INSERT INTO materials (id, code, name, type, shelf_life_days, min_storage_threshold, first_process_id) VALUES ('a8485823-58ee-4393-976a-603c531a8338'::uuid, 'MTC2', 'Material C2', 'Cathode Electrode', NULL, NULL, 'b5c17071-a20f-4ba2-b53e-6dd1b98c1946'::uuid);
INSERT INTO materials (id, code, name, type, shelf_life_days, min_storage_threshold, first_process_id) VALUES ('bd38f741-3a8c-4a01-b6d5-07ec9ae7e536'::uuid, 'MTSR', 'Roll S (Separator)', 'Separator', NULL, NULL, '81f4c276-5608-42c9-a42a-068aab14ba38'::uuid);
INSERT INTO materials (id, code, name, type, shelf_life_days, min_storage_threshold, first_process_id) VALUES ('bdff9e62-bfc2-4b32-a0b9-b0d6f444304d'::uuid, 'MTE1', 'Material E1', 'Electrolyte', NULL, NULL, 'a971751f-ceec-4738-be6c-8249c0ccf45c'::uuid);
INSERT INTO materials (id, code, name, type, shelf_life_days, min_storage_threshold, first_process_id) VALUES ('df52cda6-dfab-4ae5-bbcb-47fbbaad01e4'::uuid, 'MTCR', 'Roll C (Cathode Substrate)', 'Cathode Electrode', NULL, NULL, '8c028b13-2407-474b-ac43-93d83912b9dd'::uuid);
INSERT INTO materials (id, code, name, type, shelf_life_days, min_storage_threshold, first_process_id) VALUES ('e1aa8fe7-6966-43f5-8e7a-70979230e921'::uuid, 'MTC4', 'Material C4', 'Cathode Electrode', NULL, NULL, 'b5c17071-a20f-4ba2-b53e-6dd1b98c1946'::uuid);
INSERT INTO materials (id, code, name, type, shelf_life_days, min_storage_threshold, first_process_id) VALUES ('f5327f45-a7c0-4e42-a414-910536cbfab8'::uuid, 'MTE2', 'Material E2', 'Electrolyte', NULL, NULL, 'a971751f-ceec-4738-be6c-8249c0ccf45c'::uuid);
INSERT INTO materials (id, code, name, type, shelf_life_days, min_storage_threshold, first_process_id) VALUES ('fdbee0d7-d99b-483b-b8d4-222f1a1ec70d'::uuid, 'MTPP', 'Packaging (Casing)', 'Casing', NULL, NULL, 'da5118c4-48a9-409f-a51f-fdcfaed97493'::uuid);

-- QC check definitions
INSERT INTO qc_check_definitions (id, process_id, qc_item_name, description, method, timing, acceptance_criteria_text, acceptance_criteria_min, acceptance_criteria_max, fail_action) VALUES ('1df7cfa0-0bb1-413e-9568-294f06e3f809'::uuid, 'a1ddf202-3fe4-4e7b-b13f-5f7b1515bf71'::uuid, 'Substrate Penetration', 'Check for appropriate pressing force', 'VisualManual', 'Startup', 'No penetration', NULL, NULL, 'Hold');
INSERT INTO qc_check_definitions (id, process_id, qc_item_name, description, method, timing, acceptance_criteria_text, acceptance_criteria_min, acceptance_criteria_max, fail_action) VALUES ('21597b93-7458-4638-af4d-8e54a4f5162a'::uuid, '81f4c276-5608-42c9-a42a-068aab14ba38'::uuid, 'Accurate Width', 'Width of the new slitted roll', 'ToolEquipment', 'Startup', 'Within ± 0.1mm', NULL, NULL, 'Hold');
INSERT INTO qc_check_definitions (id, process_id, qc_item_name, description, method, timing, acceptance_criteria_text, acceptance_criteria_min, acceptance_criteria_max, fail_action) VALUES ('248af3fe-c6a6-4224-bdd8-a4e41508c0bb'::uuid, '57050fa3-b8b9-421e-9d8a-17ca9793d584'::uuid, 'Misalignment', 'Dimensional accuracy', 'VisualManual', 'EndOfRun', 'Scrap', NULL, NULL, 'Scrap');
INSERT INTO qc_check_definitions (id, process_id, qc_item_name, description, method, timing, acceptance_criteria_text, acceptance_criteria_min, acceptance_criteria_max, fail_action) VALUES ('2ece26fb-df12-4837-991a-4f2f10be3925'::uuid, 'b5c17071-a20f-4ba2-b53e-6dd1b98c1946'::uuid, 'Particle Size', 'Check maximum particle size', 'ToolEquipment', 'EndOfRun', '< 50 μm', NULL, NULL, 'Scrap');
INSERT INTO qc_check_definitions (id, process_id, qc_item_name, description, method, timing, acceptance_criteria_text, acceptance_criteria_min, acceptance_criteria_max, fail_action) VALUES ('3b6bc320-8cc5-475a-9edf-10dae73331c2'::uuid, '8c028b13-2407-474b-ac43-93d83912b9dd'::uuid, 'Cracking/Flaking', 'Appearance of dried coating', 'VisualManual', 'Startup', 'Smooth coating', NULL, NULL, 'Hold');
INSERT INTO qc_check_definitions (id, process_id, qc_item_name, description, method, timing, acceptance_criteria_text, acceptance_criteria_min, acceptance_criteria_max, fail_action) VALUES ('3d65300a-96e1-40a8-8513-9a3029d72059'::uuid, 'c5895fd9-86a4-4324-96fc-dfb505889f80'::uuid, 'Warpage', 'Wrinkles / folded pieces', 'VisualManual', 'EndOfRun', 'Scrap', NULL, NULL, 'Scrap');
INSERT INTO qc_check_definitions (id, process_id, qc_item_name, description, method, timing, acceptance_criteria_text, acceptance_criteria_min, acceptance_criteria_max, fail_action) VALUES ('556401ec-3d99-4ce7-8213-e555ebd23978'::uuid, 'b5c17071-a20f-4ba2-b53e-6dd1b98c1946'::uuid, 'Homogeneity', 'Uniform mixture', 'VisualManual', 'EndOfRun', 'No visible lumps', NULL, NULL, 'Scrap');
INSERT INTO qc_check_definitions (id, process_id, qc_item_name, description, method, timing, acceptance_criteria_text, acceptance_criteria_min, acceptance_criteria_max, fail_action) VALUES ('6492d947-ba88-4c55-9002-d95422ec7554'::uuid, '57050fa3-b8b9-421e-9d8a-17ca9793d584'::uuid, 'Warpage', 'Wrinkles / folded pieces', 'VisualManual', 'EndOfRun', 'Scrap', NULL, NULL, 'Scrap');
INSERT INTO qc_check_definitions (id, process_id, qc_item_name, description, method, timing, acceptance_criteria_text, acceptance_criteria_min, acceptance_criteria_max, fail_action) VALUES ('6bade7f2-d725-449e-9115-75d68285d681'::uuid, '8c028b13-2407-474b-ac43-93d83912b9dd'::uuid, 'Dry Thickness', 'Dry coating thickness', 'ToolEquipment', 'Startup', 'Within ± 5%', NULL, NULL, 'Hold');
INSERT INTO qc_check_definitions (id, process_id, qc_item_name, description, method, timing, acceptance_criteria_text, acceptance_criteria_min, acceptance_criteria_max, fail_action) VALUES ('6fec6a71-32a1-4bce-b838-29ebe35a9670'::uuid, '4f249480-13e2-4f73-853e-df60627f7acd'::uuid, 'Misalignment', 'Deviated stacking placement', 'VisualManual', 'EndOfRun', 'Scrap', NULL, NULL, 'Scrap');
INSERT INTO qc_check_definitions (id, process_id, qc_item_name, description, method, timing, acceptance_criteria_text, acceptance_criteria_min, acceptance_criteria_max, fail_action) VALUES ('749e7d90-8728-437e-a60b-859bc4a11a60'::uuid, 'b5c17071-a20f-4ba2-b53e-6dd1b98c1946'::uuid, 'Viscosity', 'Measure viscosity', 'ToolEquipment', 'EndOfRun', 'Within ± 2%', NULL, NULL, 'Scrap');
INSERT INTO qc_check_definitions (id, process_id, qc_item_name, description, method, timing, acceptance_criteria_text, acceptance_criteria_min, acceptance_criteria_max, fail_action) VALUES ('93eb0434-e6d3-47e3-b6eb-82ddce9b2158'::uuid, '81f4c276-5608-42c9-a42a-068aab14ba38'::uuid, 'Jagged Edges', 'Uneven edges of the roll', 'VisualManual', 'EndOfRun', '< 5% of the entire roll', NULL, NULL, 'Scrap');
INSERT INTO qc_check_definitions (id, process_id, qc_item_name, description, method, timing, acceptance_criteria_text, acceptance_criteria_min, acceptance_criteria_max, fail_action) VALUES ('96a4f241-4a33-400e-a6f1-37a1e7e5125e'::uuid, '4f249480-13e2-4f73-853e-df60627f7acd'::uuid, 'Voltage', 'Measured cell voltage', 'ToolEquipment', 'EndOfRun', '> 1.6 V', NULL, NULL, 'Scrap');
INSERT INTO qc_check_definitions (id, process_id, qc_item_name, description, method, timing, acceptance_criteria_text, acceptance_criteria_min, acceptance_criteria_max, fail_action) VALUES ('9bab8975-c66a-4c23-ba33-74fdbc3a1a11'::uuid, '4f249480-13e2-4f73-853e-df60627f7acd'::uuid, 'Label Printing Defect', 'Misalignment during label printing', 'VisualManual', 'EndOfRun', 'Scrap', NULL, NULL, 'Scrap');
INSERT INTO qc_check_definitions (id, process_id, qc_item_name, description, method, timing, acceptance_criteria_text, acceptance_criteria_min, acceptance_criteria_max, fail_action) VALUES ('bc5c9fac-a868-43e6-b8ba-a039575de801'::uuid, '57050fa3-b8b9-421e-9d8a-17ca9793d584'::uuid, 'Delamination', 'Coating section delaminates', 'VisualManual', 'EndOfRun', 'Scrap', NULL, NULL, 'Scrap');
INSERT INTO qc_check_definitions (id, process_id, qc_item_name, description, method, timing, acceptance_criteria_text, acceptance_criteria_min, acceptance_criteria_max, fail_action) VALUES ('e8fa2cb0-b354-41ce-b2d8-70e42c77df0f'::uuid, 'c5895fd9-86a4-4324-96fc-dfb505889f80'::uuid, 'Misalignment', 'Dimensional accuracy', 'VisualManual', 'EndOfRun', 'Scrap', NULL, NULL, 'Scrap');

-- Role permissions
INSERT INTO role_permissions (role_id, permission_key) VALUES ('3468ba22-bc4e-446a-8539-70f4a53d1023'::uuid, 'log_run');
INSERT INTO role_permissions (role_id, permission_key) VALUES ('3468ba22-bc4e-446a-8539-70f4a53d1023'::uuid, 'scan_qr');
INSERT INTO role_permissions (role_id, permission_key) VALUES ('3468ba22-bc4e-446a-8539-70f4a53d1023'::uuid, 'view_batch_status');
INSERT INTO role_permissions (role_id, permission_key) VALUES ('3468ba22-bc4e-446a-8539-70f4a53d1023'::uuid, 'view_work_history');
INSERT INTO role_permissions (role_id, permission_key) VALUES ('752526b8-12e7-44fb-98f1-4fbef368ae82'::uuid, 'create_preset_version');
INSERT INTO role_permissions (role_id, permission_key) VALUES ('752526b8-12e7-44fb-98f1-4fbef368ae82'::uuid, 'create_recipe');
INSERT INTO role_permissions (role_id, permission_key) VALUES ('752526b8-12e7-44fb-98f1-4fbef368ae82'::uuid, 'export_reports');
INSERT INTO role_permissions (role_id, permission_key) VALUES ('752526b8-12e7-44fb-98f1-4fbef368ae82'::uuid, 'log_run');
INSERT INTO role_permissions (role_id, permission_key) VALUES ('752526b8-12e7-44fb-98f1-4fbef368ae82'::uuid, 'override_qc');
INSERT INTO role_permissions (role_id, permission_key) VALUES ('752526b8-12e7-44fb-98f1-4fbef368ae82'::uuid, 'run_genealogy');
INSERT INTO role_permissions (role_id, permission_key) VALUES ('752526b8-12e7-44fb-98f1-4fbef368ae82'::uuid, 'scan_qr');
INSERT INTO role_permissions (role_id, permission_key) VALUES ('752526b8-12e7-44fb-98f1-4fbef368ae82'::uuid, 'set_batch_status');
INSERT INTO role_permissions (role_id, permission_key) VALUES ('752526b8-12e7-44fb-98f1-4fbef368ae82'::uuid, 'view_batch_status');
INSERT INTO role_permissions (role_id, permission_key) VALUES ('752526b8-12e7-44fb-98f1-4fbef368ae82'::uuid, 'view_dashboard');
INSERT INTO role_permissions (role_id, permission_key) VALUES ('752526b8-12e7-44fb-98f1-4fbef368ae82'::uuid, 'view_work_history');
INSERT INTO role_permissions (role_id, permission_key) VALUES ('bdc93b0a-fb76-4498-a2e9-83bc7dc72ddf'::uuid, 'access_audit_log');
INSERT INTO role_permissions (role_id, permission_key) VALUES ('bdc93b0a-fb76-4498-a2e9-83bc7dc72ddf'::uuid, 'configure_steps');
INSERT INTO role_permissions (role_id, permission_key) VALUES ('bdc93b0a-fb76-4498-a2e9-83bc7dc72ddf'::uuid, 'manage_equipment');
INSERT INTO role_permissions (role_id, permission_key) VALUES ('bdc93b0a-fb76-4498-a2e9-83bc7dc72ddf'::uuid, 'manage_users');

-- ── Equipment (23 machines confirmed by Flint 2026-06-05) ────────────────────
-- checklist_template: per-machine maintenance checklist tasks (Admin-editable in the app).
INSERT INTO equipment (id, equipment_code, name, process_id, supplier_info, is_active, checklist_template) VALUES
  ('a1000001-0000-0000-0000-000000000001'::uuid, 'MA001', '60L Mixer',                'b5c17071-a20f-4ba2-b53e-6dd1b98c1946'::uuid, NULL, true, '["Mixing Blade Inspection", "Seal Check", "Speed Calibration"]'::jsonb),
  ('a1000001-0000-0000-0000-000000000002'::uuid, 'MA002', '5L Mixer',                 'a971751f-ceec-4738-be6c-8249c0ccf45c'::uuid, NULL, true, '["Mixing Blade Inspection", "Seal Check", "Speed Calibration"]'::jsonb),
  ('a1000001-0000-0000-0000-000000000003'::uuid, 'MA003', 'Coating Machine - Input',  '8c028b13-2407-474b-ac43-93d83912b9dd'::uuid, NULL, true, '["Rail Lubrication", "Distance Calibration", "Joint Lubrication"]'::jsonb),
  ('a1000001-0000-0000-0000-000000000004'::uuid, 'MA004', 'Coating Machine - Output', '8c028b13-2407-474b-ac43-93d83912b9dd'::uuid, NULL, true, '["Rail Lubrication", "Distance Calibration", "Joint Lubrication"]'::jsonb),
  ('a1000001-0000-0000-0000-000000000005'::uuid, 'MA005', 'Oven Chamber 1',           '8c028b13-2407-474b-ac43-93d83912b9dd'::uuid, NULL, true, '["Temperature Check", "Door Seal Inspection", "Heating Element Check"]'::jsonb),
  ('a1000001-0000-0000-0000-000000000006'::uuid, 'MA006', 'Oven Chamber 2',           '8c028b13-2407-474b-ac43-93d83912b9dd'::uuid, NULL, true, '["Temperature Check", "Door Seal Inspection", "Heating Element Check"]'::jsonb),
  ('a1000001-0000-0000-0000-000000000007'::uuid, 'MA007', 'Oven Chamber 3',           '8c028b13-2407-474b-ac43-93d83912b9dd'::uuid, NULL, true, '["Temperature Check", "Door Seal Inspection", "Heating Element Check"]'::jsonb),
  ('a1000001-0000-0000-0000-000000000008'::uuid, 'MA008', 'Oven Chamber 4',           '8c028b13-2407-474b-ac43-93d83912b9dd'::uuid, NULL, true, '["Temperature Check", "Door Seal Inspection", "Heating Element Check"]'::jsonb),
  ('a1000001-0000-0000-0000-000000000009'::uuid, 'MA009', 'Oven Chamber 5',           '8c028b13-2407-474b-ac43-93d83912b9dd'::uuid, NULL, true, '["Temperature Check", "Door Seal Inspection", "Heating Element Check"]'::jsonb),
  ('a1000001-0000-0000-0000-000000000010'::uuid, 'MA010', 'Oven Chamber 6',           '8c028b13-2407-474b-ac43-93d83912b9dd'::uuid, NULL, true, '["Temperature Check", "Door Seal Inspection", "Heating Element Check"]'::jsonb),
  ('a1000001-0000-0000-0000-000000000011'::uuid, 'MA011', 'Calendering - Input',      'a1ddf202-3fe4-4e7b-b13f-5f7b1515bf71'::uuid, NULL, true, '["Roller Pressure Check", "Belt Inspection", "Lubrication"]'::jsonb),
  ('a1000001-0000-0000-0000-000000000012'::uuid, 'MA012', 'Calendering - Roller',     'a1ddf202-3fe4-4e7b-b13f-5f7b1515bf71'::uuid, NULL, true, '["Roller Pressure Check", "Belt Inspection", "Lubrication"]'::jsonb),
  ('a1000001-0000-0000-0000-000000000013'::uuid, 'MA013', 'Calendering - Output',     'a1ddf202-3fe4-4e7b-b13f-5f7b1515bf71'::uuid, NULL, true, '["Roller Pressure Check", "Belt Inspection", "Lubrication"]'::jsonb),
  ('a1000001-0000-0000-0000-000000000014'::uuid, 'MA014', 'Die Cutting - Input',      '57050fa3-b8b9-421e-9d8a-17ca9793d584'::uuid, NULL, true, '["Blade Inspection", "Alignment Check", "Lubrication"]'::jsonb),
  ('a1000001-0000-0000-0000-000000000015'::uuid, 'MA015', 'Die Cutting - Main',       '57050fa3-b8b9-421e-9d8a-17ca9793d584'::uuid, NULL, true, '["Blade Inspection", "Alignment Check", "Lubrication"]'::jsonb),
  ('a1000001-0000-0000-0000-000000000016'::uuid, 'MA016', 'Slitting',                 '81f4c276-5608-42c9-a42a-068aab14ba38'::uuid, NULL, true, '["Blade Sharpness Check", "Tension Calibration", "Lubrication"]'::jsonb),
  ('a1000001-0000-0000-0000-000000000017'::uuid, 'MA017', 'Cutting',                  'c5895fd9-86a4-4324-96fc-dfb505889f80'::uuid, NULL, true, '["Blade Sharpness Check", "Tension Calibration", "Lubrication"]'::jsonb),
  ('a1000001-0000-0000-0000-000000000018'::uuid, 'MA018', 'Cell Assembly',            '4f249480-13e2-4f73-853e-df60627f7acd'::uuid, NULL, true, '["Station Alignment", "Gripper Inspection", "Electrolyte Leak Check"]'::jsonb),
  ('a1000001-0000-0000-0000-000000000019'::uuid, 'MA019', 'Compressor Unit',          '8c028b13-2407-474b-ac43-93d83912b9dd'::uuid, NULL, true, '["Pressure Check", "Leak Inspection", "Filter Inspection"]'::jsonb),
  ('a1000001-0000-0000-0000-000000000020'::uuid, 'MA020', 'Compressor Chiller',       '8c028b13-2407-474b-ac43-93d83912b9dd'::uuid, NULL, true, '["Pressure Check", "Leak Inspection", "Filter Inspection"]'::jsonb),
  ('a1000001-0000-0000-0000-000000000021'::uuid, 'MA021', 'Compressor Tank',          '8c028b13-2407-474b-ac43-93d83912b9dd'::uuid, NULL, true, '["Pressure Check", "Leak Inspection", "Filter Inspection"]'::jsonb),
  ('a1000001-0000-0000-0000-000000000022'::uuid, 'MA022', 'Water Purification',       'b5c17071-a20f-4ba2-b53e-6dd1b98c1946'::uuid, NULL, true, '["Filter Replacement Check", "Flow Rate Check", "Membrane Inspection"]'::jsonb),
  ('a1000001-0000-0000-0000-000000000023'::uuid, 'MA023', 'Vacuum Unit',              '4f249480-13e2-4f73-853e-df60627f7acd'::uuid, NULL, true, '["Vacuum Level Check", "Seal Inspection", "Pump Lubrication"]'::jsonb)
ON CONFLICT (equipment_code) DO NOTHING;
