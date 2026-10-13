# Prompt Index

The numbered prompts are intended to be executed in order unless the master plan explicitly permits parallel work. A prompt is a bounded work packet, not permission to continue into the next packet.

| # | Packet | Purpose | Executor | File |
|---:|---|---|---|---|
| 01 | `L0.1` | Pin upstream revision and build provenance | LOCAL | `01_L0_1_pin_upstream_revision_and_build_provenance.md` |
| 02 | `L0.2` | Capture untouched baseline build and metrics | LOCAL | `02_L0_2_capture_untouched_baseline_build_and_metrics.md` |
| 03 | `L0.3a` | Add strict TypeScript tooling and boundary interfaces | LOCAL | `03_L0_3a_add_strict_typescript_tooling_and_boundary_interfaces.md` |
| 04 | `L0.3b` | Port pure wrapper modules to TypeScript | LOCAL | `04_gemini_3.6_flash_L0_3b_port_pure_wrapper_modules_to_typescript.md` |
| 05 | `L0.3c` | Port process-management wrapper modules to TypeScript | LOCAL | `05_gemini_3.6_flash_L0_3c_port_process_management_wrapper_modules_to_typescript.md` |
| 06 | `L0.4` | Build the language-neutral replacement harness | LOCAL | `06_gemini_3.6_flash_L0_4_build_the_language_neutral_replacement_harness.md` |
| 07 | `L0.5` | Create the permanent performance harness | LOCAL | `07_gemini_3.6_flash_L0_5_create_the_permanent_performance_harness.md` |
| 08 | `L0.6` | Implement safe interactive port-conflict recovery | LOCAL | `08_gemini_3.6_flash_L0_6_implement_safe_interactive_port_conflict_recovery.md` |
| 09 | `L1.1` | Produce dependency and packaged-size inventory | LOCAL | `09_gemini_3.5_flash_lite_L1_1_produce_dependency_and_packaged_size_inventory.md` |
| 10 | `L1.2` | Build and validate a no-Docling core runtime | LOCAL | `10_gemini_3.6_flash_L1_2_build_and_validate_a_no_docling_core_runtime.md` |
| 11 | `L1.3` | Prototype demand-loaded or isolated Docling | LOCAL | `11_gemini_3.6_flash_L1_3_prototype_demand_loaded_or_isolated_docling.md` |
| 12 | `L1.4` | Profile Python API and worker import/memory overlap | LOCAL | `12_gemini_3.6_flash_L1_4_profile_python_api_and_worker_import_memory_overlap.md` |
| 13 | `L1.5` | Benchmark Python worker concurrency settings | LOCAL | `13_gemini_3.6_flash_L1_5_benchmark_python_worker_concurrency_settings.md` |
| 14 | `L1.6` | Prototype an on-demand Python worker lifecycle | LOCAL | `14_gemini_3.6_flash_L1_6_prototype_an_on_demand_python_worker_lifecycle.md` |
| 15 | `L2.1` | Freeze the native-host contract | LOCAL | `15_gemini_3.1_pro_L2_1_freeze_the_native_host_contract.md` |
| 16 | `L2.2` | Build the minimal Rust/Tauri host candidate | LOCAL | `16_gemini_3.1_pro_L2_2_build_the_minimal_rust_tauri_host_candidate.md` |
| 17 | `L2.3` | Build the minimal Go/Wails host candidate | LOCAL | `17_gemini_3.1_pro_L2_3_build_the_minimal_go_wails_host_candidate.md` |
| 18 | `L2.4` | Build the minimal C#/WinUI/WebView2 host candidate | LOCAL | `18_gemini_3.1_pro_L2_4_build_the_minimal_c_winui_webview2_host_candidate.md` |
| 19 | `L2.5` | Score native-host candidates and select one | LOCAL | `19_gemini_3.1_pro_L2_5_score_native_host_candidates_and_select_one.md` |
| 20 | `L3.1` | Inventory every Next.js server responsibility | LOCAL | `20_gemini_3.6_flash_L3_1_inventory_every_next_js_server_responsibility.md` |
| 21 | `L3.2` | Freeze API proxy, upload, and SSE compatibility fixtures | LOCAL | `21_gemini_3.6_flash_L3_2_freeze_api_proxy_upload_and_sse_compatibility_fixtures.md` |
| 22 | `L3.3` | Build a parallel static/client frontend proof of concept | LOCAL | `22_gemini_3.6_flash_L3_3_build_a_parallel_static_client_frontend_proof_of_concept.md` |
| 23 | `L3.4` | Prepare the bounded handoff into Section 19 | LOCAL | `23_gemini_3.6_flash_L3_4_prepare_the_bounded_handoff_into_section_19.md` |
| 24 | `X19` | Move frontend serving and API proxying into native host — NON-LOCAL | NON-LOCAL | `24_gemini_3.1_pro_X19_move_frontend_serving_and_api_proxying_into_native_host_non_local.md` |
| 25 | `X20` | Remove bundled Node.js — NON-LOCAL | NON-LOCAL | `25_gemini_3.1_pro_X20_remove_bundled_node_js_non_local.md` |
| 26 | `L4.1` | Productionize the selected native host against current services | LOCAL | `26_gemini_3.1_pro_L4_1_productionize_the_selected_native_host_against_current_services.md` |
| 27 | `L4.2` | Replace ad hoc PID-tree cleanup with OS-owned containment | LOCAL | `27_gemini_3.1_pro_L4_2_replace_ad_hoc_pid_tree_cleanup_with_os_owned_containment.md` |
| 28 | `L4.3` | Improve service readiness and ongoing health semantics | LOCAL | `28_gemini_3.1_pro_L4_3_improve_service_readiness_and_ongoing_health_semantics.md` |
| 29 | `L4.4` | Remove Electron behind a rollback build | LOCAL | `29_gemini_3.1_pro_L4_4_remove_electron_behind_a_rollback_build.md` |
| 30 | `L4.5` | Run native-host chaos and security review | LOCAL | `30_gemini_3.1_pro_L4_5_run_native_host_chaos_and_security_review.md` |
| 31 | `L5.1` | Modularize runtime packaging | LOCAL | `31_gemini_3.6_flash_L5_1_modularize_runtime_packaging.md` |
| 32 | `L5.2` | Run installer variant experiments | LOCAL | `32_gemini_3.6_flash_L5_2_run_installer_variant_experiments.md` |
| 33 | `L5.3` | Validate clean-machine installation and upgrade paths | LOCAL | `33_gemini_3.6_flash_L5_3_validate_clean_machine_installation_and_upgrade_paths.md` |
| 34 | `L6` | Re-profile the simplified application | LOCAL | `34_gemini_3.5_flash_lite_L6_re_profile_the_simplified_application.md` |
| 35 | `L7.1` | Optimize one proven Python CPU hotspot with Cython | LOCAL | `35_gemini_3.1_pro_L7_1_optimize_one_proven_python_cpu_hotspot_with_cython.md` |
| 36 | `L7.2` | Optimize one proven Python leaf with a Rust extension | LOCAL | `36_gemini_3.1_pro_L7_2_optimize_one_proven_python_leaf_with_a_rust_extension.md` |
| 37 | `L7.3` | Integrate a C/C++ leaf only when an established native library warrants it | LOCAL | `37_gemini_3.1_pro_L7_3_integrate_a_c_c_leaf_only_when_an_established_native_library_warrants_.md` |
| 38 | `L7.4` | Build a discrete Go or C# helper only if the boundary is simpler than host integration | LOCAL | `38_gemini_3.1_pro_L7_4_build_a_discrete_go_or_c_helper_only_if_the_boundary_is_simpler_than_h.md` |
| 39 | `L7.5` | Study Python worker migration without implementing a rewrite | LOCAL | `39_gemini_3.1_pro_L7_5_study_python_worker_migration_without_implementing_a_rewrite.md` |
| 40 | `L7.6` | Study FastAPI/native backend feasibility without committing to a rewrite | LOCAL | `40_gemini_3.1_pro_L7_6_study_fastapi_native_backend_feasibility_without_committing_to_a_rewri.md` |
| 41 | `L8.1` | Audit loopback networking and navigation isolation | LOCAL | `41_gemini_3.5_flash_lite_L8_1_audit_loopback_networking_and_navigation_isolation.md` |
| 42 | `L8.2` | Audit secrets, paths, diagnostics, dependencies, and licenses | LOCAL | `42_gemini_3.5_flash_lite_L8_2_audit_secrets_paths_diagnostics_dependencies_and_licenses.md` |
| 43 | `L8.3` | Run golden extraction, RAG, and API contract regression | LOCAL | `43_gemini_3.5_flash_lite_L8_3_run_golden_extraction_rag_and_api_contract_regression.md` |
| 44 | `L8.4` | Finalize CI lanes, release gates, rollback, and canary controls | LOCAL | `44_gemini_3.5_flash_lite_L8_4_finalize_ci_lanes_release_gates_rollback_and_canary_controls.md` |
| 45 | `L8.5` | Refresh architecture, operations docs, and final benchmark scorecard | LOCAL | `45_gemini_3.5_flash_lite_L8_5_refresh_architecture_operations_docs_and_final_benchmark_scorecard.md` |
