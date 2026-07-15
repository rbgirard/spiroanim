# Project Overview

- This is a Vue 3 application built with Vite and TypeScript.
- Use the Vue Composition API and `<script setup lang="ts">` in single-file components.
- The application may eventually support SSR. Keep reusable logic independent of browser-only APIs where practical.
- Three.js and editor-related functionality will primarily run on the client.
- Use custom UI components rather than Vuetify or another full UI framework.

# Project Structure

- Use `@/*` as the single source alias for `src/*`. Prefer explicit paths such as `@/components/ui/BaseButton.vue` or `@/features/editor/types` instead of adding aliases for each top-level directory.
- Keep route-level components in `src/views`. Views should primarily compose layouts and features rather than contain substantial business logic.
- Keep broadly reusable presentation components in `src/components`, with low-level controlled primitives in `src/components/ui`, application-shell components in `src/components/layout`, and reusable icon infrastructure in `src/components/icons`.
- Keep application-wide composables in `src/composables` and application-wide Pinia stores in `src/stores`. Code owned by one feature belongs with that feature instead.
- Keep substantial product functionality under `src/features/<feature>`. A feature may contain its own `components`, `composables`, `stores`, `types`, `math`, and `workers` when those items are not meaningfully shared.
- Keep shared domain and cross-feature types in `src/types`. Keep feature-specific types beside their feature and continue to use authoritative library types directly.
- Keep authoritative application-wide runtime domain definitions, constants, topology, and relationships under `src/domain/<domain>`. Keep compile-time contracts in `src/types`, reusable calculations in `src/math`, external-effect boundaries in `src/services`, and feature-owned behavior under its feature.
- Keep `src/domain` narrowly focused on the application's core runtime vocabulary and rules. Do not use it for UI components, stores, generic utilities, framework infrastructure, or miscellaneous code that lacks a clear domain owner.
- Determine ownership from actual consumers across the complete application rather than from the first feature or migration task that needs the code.
- Place code under `src/features/<feature>` only when that feature meaningfully owns it and other consumers access it as part of that feature's public responsibility.
- Do not place broadly consumed application contracts under one feature merely because that feature is their first or primary consumer.
- Treat types for the application's central data model as shared domain types in `src/types` when they are consumed across stores, workers, serialization, rendering, services, or multiple features.
- Keep shared pure geometry, vector, quaternion, curve, interpolation, animation, and numeric logic in `src/math`.
- Keep persistence, serialization, file import/export, and other external-effect boundaries in `src/services`.
- Keep small, pure, broadly reusable helpers in `src/utils`. Prefer a more specific feature, math, service, or worker location whenever one applies.
- Keep shared workers and worker infrastructure in `src/workers`. Place a worker used by only one feature under that feature, and keep its typed message contracts and client adapter beside it.
- Keep build, generated-declaration, global-type, and similar infrastructure in `src/sys` as described below.
- Do not introduce vague overlapping directories such as `common`, `shared`, `helpers`, `managers`, `models`, or `controllers` without an approved, clearly distinct responsibility.
- Create feature subdirectories only when corresponding code exists. Do not add speculative layers or barrel files solely to mirror the directory structure.

# Core Dependencies

- Runtime dependencies include Vue 3, Vue Router, Pinia, `pinia-plugin-persistedstate`, VueUse (`@vueuse/core`), Three.js, and `@mdi/js`.
- `pinia-plugin-persistedstate` is registered once on the application Pinia instance in `src/main.ts`. Individual stores opt into persistence through their store configuration.
- Testing uses Vitest with jsdom, Vue Test Utils for component tests, and Playwright for end-to-end tests.
- `unplugin-auto-import` is configured through `vite.config.ts`, using `src/sys/auto-imports.ts` as its curated source list and generating declarations under `src/sys`.

# TypeScript Standards

- Use strict TypeScript. The project extends the strict Vue TypeScript configuration and enables `noUncheckedIndexedAccess` for application code.
- Never introduce `any`. If a solution appears to require it, first seek a properly typed alternative. Ask for guidance only when no sound alternative is available.
- Do not use `as unknown` or double assertions merely to bypass the type system. Use them only at unavoidable external boundaries, with a concise explanation and the narrowest possible scope.
- Preserve type inference and IntelliSense. Prefer explicit reusable types over repeated inline object shapes.
- Avoid unnecessary type assertions and do not suppress errors with `@ts-ignore`.
- Use `@ts-expect-error` only when the error is intentional, documented, and tested.
- Give public functions, composables, stores, and component contracts clear types.
- Keep runtime validation separate from compile-time typing when both are needed.
- Prefer types exported by Vue and other installed libraries over locally recreated equivalents. Preserve the library's generics, inference, overloads, and future compatibility whenever practical.
- Before defining a new application type for a framework or library concept, inspect that package's exported TypeScript definitions and reuse, extend, narrow, or compose them.
- Do not copy library type structures into local interfaces merely to avoid an import.
- Common, unambiguous type-only definitions may be exposed globally through `src/sys/global.d.ts` when they are used broadly throughout the application.
- Global type aliases must directly reference their authoritative platform or library definitions. Do not maintain independent copies of upstream definitions.
- Keep feature-specific, domain-specific, rarely used, or potentially ambiguous types explicitly imported. Global declarations should remain a small curated vocabulary rather than a substitute for modules.
- Use globally available types without redundant type imports. When an upstream type is not part of the curated globals, import it directly from its owning library.
- When extending global interfaces such as `Window`, keep the augmentation narrow and use the authoritative external type when one exists.

# Vue Standards

- Use the Composition API and `<script setup lang="ts">`.
- Order Vue single-file component sections as `<template>` first, `<script setup lang="ts">` second, and `<style>` last. Omit any section that the component does not need without changing the relative order of the remaining sections.
- Prefer `ref`, `computed`, and focused composables over large component scripts.
- Keep business logic out of presentation components and move reusable stateful logic into composables.
- Use Pinia for shared application state, not as a substitute for local component state.
- Prefer setup-style Pinia stores: `defineStore(id, () => {})`.
- Persist Pinia state only when it must survive a reload or browser restart. Persistence is opt-in per store; do not persist every store by default.
- Prefer an explicit persisted-state `pick` list over persisting an entire store unless persistence of the complete state is deliberate and documented.
- Persist only serializable application data. Do not persist Vue reactive internals, DOM objects, functions, workers, or Three.js instances; define an explicit serialization format when richer objects must be reconstructed.
- Never persist credentials, access tokens, secrets, or other security-sensitive values in browser storage.
- Treat persisted state as a versioned data contract. When changing persisted fields, keys, types, or meaning, provide an intentional migration, compatibility, or reset strategy.
- Keep direct browser-storage access behind an explicit client boundary so stores and reusable modules remain safe for possible SSR evaluation.
- Register Pinia plugins only in application bootstrap or an equivalent test bootstrap. Do not register `pinia-plugin-persistedstate` from individual stores or components.
- Do not destructure reactive objects in ways that break reactivity; use `storeToRefs` where appropriate.
- Prefer computed values or explicit events to watchers when they express the behavior more clearly.
- Clean up event listeners, observers, animation frames, workers, and other resources when components unmount.

# Auto-Import Conventions

- `unplugin-auto-import` is configured in `vite.config.ts`. Runtime auto-imports are declared centrally in `src/sys/auto-imports.ts`.
- Before adding an explicit import from Vue, Pinia, Vue Router, or VueUse, check `src/sys/auto-imports.ts`. Do not explicitly import a symbol that is already configured for auto-import unless a concrete technical reason requires it.
- Add frequently used runtime APIs to `src/sys/auto-imports.ts` only when they are broadly useful across the application. Keep specialized, ambiguous, side-effectful, or rarely used APIs explicitly imported at their usage sites.
- Prefer framework and library APIs over locally reimplementing equivalent reactive, routing, store, lifecycle, DOM, or utility behavior.
- `src/sys/auto-imports-generated.d.ts` is generated by `unplugin-auto-import`, intentionally ignored by Git, and must never be edited manually.
- Regenerate the auto-import declaration through the normal Vite or build process after changing `src/sys/auto-imports.ts`.
- Do not assume that a symbol is globally available merely because its library is installed. It must appear in the generated declaration or in an intentional declaration under `src/sys`.
- Auto-imports provide runtime values. Global type aliases are a separate mechanism and belong in `src/sys/global.d.ts`.

# System Definitions (`src/sys`)

- Treat `src/sys` as infrastructure shared by the application, TypeScript, and build tooling.
- `src/sys/auto-imports.ts` is the single source of truth for globally auto-imported runtime APIs.
- `src/sys/global.d.ts` is the single source of truth for intentional application-wide type aliases and global interface augmentation.
- `src/sys/auto-imports-generated.d.ts` is generated output and must never be edited manually.
- Keep files in `src/sys` free of application state, browser startup behavior, and unrelated side effects because build and test configuration may load them in a Node environment.
- Use `import type` for dependencies used only to construct global type aliases.
- Every global alias should be backed directly by an authoritative platform or library type. Avoid locally reconstructed approximations and preserve upstream generic parameters.
- Use clear aliases when an upstream name could conflict with DOM globals, application models, or another library.
- Add a runtime API or type to the global vocabulary only when repeated use justifies the reduced explicitness.
- After changing auto-import or global declarations, regenerate declarations and run applicable formatting, linting, type checking, tests, and the build.

# Component Standards

- Reusable components belong in `src/components`. Place low-level controlled UI primitives in `src/components/ui`, layout and application-shell components in `src/components/layout`, and feature-owned components under their feature.
- Keep UI components focused, reusable, and presentational where practical. Prefer controlled components using props and emitted events.
- Low-level reusable UI components must not import application stores. Feature-specific components may use stores only when that dependency is part of their documented responsibility.
- Prefer semantic native HTML and avoid unnecessary wrappers.
- Accessibility is required: support keyboard interaction, focus behavior, labels, disabled states, and appropriate ARIA attributes where native semantics are insufficient.
- Prefer CSS custom properties and deliberate component variants over duplicate implementations.
- Keep component APIs small. Use `defineModel` when the component genuinely exposes a model contract; otherwise use explicit props and emits.
- Add meaningful Vitest and Vue Test Utils tests for reusable UI components when they expose behavior, state, interaction, accessibility requirements, or a public contract. Cover public behavior such as props, rendering, emitted events, keyboard interaction, disabled behavior, model updates, and accessibility attributes.
- Avoid tests coupled to private implementation details and avoid large snapshots.

# Design Tokens and Styling

- Treat the design-token stylesheets as the source of truth for reusable visual values.
- Store design tokens under `src/assets/styles`.
- Keep theme-independent tokens such as spacing, typography, radii, shadows, and motion separate from color-scheme definitions.
- Separate primitive palette tokens from semantic color tokens. Primitive tokens describe a value, such as `--palette-blue-600`; semantic tokens describe a purpose, such as `--color-action-primary`.
- Components must consume semantic color tokens and must not reference primitive palette tokens directly.
- Do not use raw color values in Vue component styles unless the color represents fixed content whose meaning must not change between themes. Document such exceptions briefly.
- Name tokens according to purpose rather than visual appearance. Prefer `--color-text-muted` over `--color-gray`.
- Define theme variations centrally using selectors on the document root, such as `[data-theme='dark']`.
- A theme must redefine semantic tokens without requiring theme-specific rules inside components. Do not add selectors such as `.dark .component` or `[data-theme] .component` to reusable components.
- Set the native CSS `color-scheme` property for each supported theme.
- Treat `system`, `light`, and `dark` as application preferences rather than component concerns.
- Components must remain usable when no explicit theme attribute is present; default root tokens must provide the fallback theme.
- Use CSS custom properties for values that participate in the design system. Keep a value local when it is genuinely specific to one component and unlikely to be reused or themed.
- Prefer an existing token over adding a near-duplicate. Search the token definitions before creating one.
- Add tokens only for demonstrated UI needs. Do not create speculative token scales or component-specific tokens without current usage.
- Reusable UI components may define private custom properties for internal composition, but their names must be component-scoped, such as `--button-icon-gap`.
- Introduce global component-specific semantic tokens, such as `--button-primary-background`, only when broader semantic tokens cannot express the component contract cleanly.
- Use component variants and state selectors to map component behavior onto semantic tokens. Do not duplicate components solely to produce different colors.
- Provide tokens for interactive states when needed, including hover, active, focus, selected, and disabled states.
- Focus indicators must remain clearly visible in every supported theme and must not rely on color alone when additional indication is necessary.
- Maintain sufficient text, control, focus, and boundary contrast across every supported theme.
- Prefer logical CSS properties such as `padding-inline` and `margin-block` where practical.
- Respect user preferences such as `prefers-reduced-motion`; do not make essential behavior depend on animation.
- Avoid `!important` except when overriding an external boundary that cannot reasonably be controlled another way. Document the reason.
- Do not migrate Vuetify class names, theme variables, component APIs, layout conventions, or styling abstractions into the new UI system.
- When migrating legacy UI, preserve required behavior but redesign its styling against the current tokens and reusable components.
- Organize global styles under `src/assets/styles` using `tokens.css` for theme-independent design values, `themes.css` for palettes and semantic color assignments, `base.css` for resets and native-element defaults, and `main.css` for ordered imports and application-level rules. Create these files only when corresponding styles exist.

# Custom UI and Icons

- Do not add Vuetify or another full UI framework unless explicitly requested.
- Build custom UI components where practical, especially buttons, sliders, range sliders, icon buttons, panels, and inputs. For complex interactive primitives such as menus, dialogs, comboboxes, popovers, and tooltips, prefer native platform behavior or evaluate a lightweight headless implementation before building one from scratch.
- Use `@mdi/js` paths through a reusable icon component instead of duplicating SVG markup.
- Keep the base icon component independent of application state and icons tree-shakeable by importing only used paths.

# Composable Standards

- Give each composable one focused responsibility, use the `use` prefix, and use a `.ts` filename.
- Do not hide unrelated global side effects inside composables. Accept dependencies as parameters when that improves testability.
- Keep browser-only work in lifecycle hooks or behind environment guards. Shared or potentially SSR-evaluated modules must not access browser APIs during module initialization. Browser-only modules may do so only when their client-only execution boundary is explicit.
- Return a clear, intentionally designed public API and add unit tests for meaningful behavior.

# Three.js and Math Standards

- Separate pure vector, quaternion, angle, geometry, interpolation, and animation calculations from rendering code.
- Prefer pure functions for reusable math and add focused tests, especially for zero-length vectors, parallel and antiparallel vectors, floating-point tolerances, and angle wrapping.
- Avoid unnecessary per-frame allocations and normalization. Clearly document guarantees such as already-normalized inputs.
- Reuse temporary Three.js objects in hot paths when safe.
- Do not mutate caller-owned vectors, quaternions, matrices, or geometries unless the contract explicitly permits it.
- Dispose of geometries, materials, textures, render targets, controls, listeners, and renderer resources when no longer needed.
- Keep renderers, canvases, DOM integration, controls, and WebGL-dependent initialization client-side. Pure Three.js math and data-processing code may run in non-browser environments when supported.

# Worker Standards

- Keep worker message contracts strongly typed. Prefer discriminated unions or typed request maps to loose strings and payloads.
- Keep communication symmetrical where the architecture supports it.
- Handle worker termination and pending requests during cleanup.
- Keep serializable data separate from Three.js instances unless an explicit serialization format is used.
- Add tests for message routing and error behavior where practical.

# Testing Standards

- Use Vitest for unit tests, Vue Test Utils for Vue component tests, and Playwright for complete user workflows.
- Place unit and component test files in an `__tests__` subdirectory under the closest owning module, feature, or component directory. Create these directories only when corresponding tests exist.
- Reserve a root-level `tests` directory for end-to-end tests, shared test infrastructure, fixtures, and cross-feature integration tests.
- Add tests for new reusable utilities, composables, stores, and UI components when they contain meaningful logic, behavior, edge cases, or public contracts.
- For persisted stores, test the observable persistence and hydration behavior, including selected fields and applicable migration or reset behavior. Isolate or clear mocked browser storage between tests so persisted data cannot leak across test cases.
- Bug fixes should include a regression test when the behavior can be tested reliably at a reasonable cost. Otherwise, document why a test was not added.
- Test observable behavior and public contracts, not private implementation details.
- Keep tests deterministic and independent of execution order.
- Do not leave skipped, focused, or intentionally failing tests, and avoid large snapshots.
- Mock browser APIs and external boundaries only when necessary; avoid mocking internal implementation details.
- Prefer meaningful tests over chasing arbitrary coverage percentages.

# Code Quality

- Keep files and functions focused, prefer clear code over clever abstractions, and introduce abstractions only when they remove real duplication or establish a useful boundary.
- Search the repository before creating utilities, components, or abstractions.
- When multiple valid implementations exist, prefer consistency with the surrounding code over introducing a new pattern.
- Avoid unrelated refactors and formatting-only changes while implementing a scoped task.
- When refactoring, preserve observable behavior unless the task explicitly changes it. Remove dead code created by the change, and leave no temporary debugging output or commented-out implementations.
- Do not add a dependency when a small, maintainable implementation is sufficient.
- Treat comments as part of the codebase. Preserve their intent and technical detail when they remain accurate; update them when implementation changes make them inaccurate. Remove comments only when obsolete, misleading, or explicitly requested, and never replace meaningful explanations with generic summaries.
- Prefer extending existing abstractions over introducing parallel implementations that solve the same problem.
- Do not preserve an existing pattern merely for consistency when it is known to be incorrect, unsafe, deprecated, or incompatible with the requested change. Explain the exception before introducing a replacement pattern.
- Avoid changing public component props, emitted events, composable return contracts, store APIs, serialized formats, or worker message contracts unless required by the task.

# Documentation

- Update documentation when behavior, architecture, commands, or public APIs change.
- Keep this file focused on durable agent instructions. Put detailed architecture in `ARCHITECTURE.md` or an appropriate file under `docs/`.
- Add nested `AGENTS.md` files only for meaningful local rules, and include only additions or overrides for that directory.
- When a preference is declared a permanent convention, record it in the appropriate documentation instead of relying on conversation history.

# Legacy Code Migration

- Treat code imported or converted from the old system as source material, not as an architectural template for the new application.
- Before placing migrated code, inspect its consumers across the complete legacy application and identify whether each responsibility is application-wide, feature-owned, route-level, presentational, pure math, an external-effect service, a worker boundary, a shared type, or system infrastructure. Determine ownership from the complete consumer graph rather than the immediate migration task, then place it according to the current project structure.
- Do not preserve old directory names, module boundaries, global state, inheritance patterns, browser assumptions, or duplicated utilities merely to minimize the textual diff.
- Prefer Vue Composition API, setup-style Pinia stores, current library TypeScript definitions, and the existing auto-import and global-type conventions when replacing old equivalents.
- Do not automatically carry undocumented old local-storage, cookie, or persistence behavior into a migrated Pinia store. However, treat an explicitly documented manual persistence mechanism as intentional behavior: preserve its trigger timing, debounce or throttle behavior, selected fields, hydration behavior, error handling, and storage keys unless the user explicitly approves a redesign. Do not replace manual persistence with `pinia-plugin-persistedstate`, or replace plugin persistence with manual persistence, merely to match a preferred convention.
- Separate reusable pure calculations from DOM, Vue, Three.js rendering, persistence, and worker orchestration while migrating code when that separation is reasonably scoped to the task.
- Search the new repository for an existing component, composable, type, utility, math function, service, store, or worker contract before bringing over an old implementation.
- Before migrating, renaming, consolidating, or removing an exported legacy symbol, search the entire legacy source tree for all consumers. Preserve or intentionally map every externally used contract, and report significant old-to-new API mappings.
- Audit comments in every legacy file being migrated before editing it. Preserve or update comments that carry rationale, constraints, compatibility requirements, edge cases, units, ordering dependencies, or other non-obvious technical knowledge. Remove a legacy comment only when it is redundant, obsolete, misleading, or explicitly requested, and report the removal when it discards information rather than restating code.
- Preserve legacy comments verbatim by default during migration. Moving a comment with its code is allowed, but shortening, paraphrasing, consolidating, or replacing it with a generic summary requires a concrete correctness reason. Style cleanup is not sufficient. If a comment must change because an implementation detail changed, retain all still-valid rationale and technical detail and report the change.
- Before completing a migrated file, compare its comments against the legacy source and account for every removed or materially rewritten comment. Do not rely on tests or type checking to catch lost documentation.
- Treat a legacy file's exported API, internal grouping, and comments as intentional until repository-wide consumer analysis demonstrates otherwise.
- Treat implementation choices accompanied by explanatory comments as design decisions, not cleanup opportunities. Examples include manual persistence instead of a plugin, JSON cloning instead of another clone mechanism, deliberate shallow reactivity, mutation order, preallocated scratch objects, compatibility branches, and unusual error handling.
- Migration approval authorizes the minimum path, import, framework, and strict-typing adaptations needed to make the legacy module work in the current project. It does not authorize redesign, modernization, cleanup, renaming, storage-key changes, serialization changes, timing changes, or substitution of an equivalent-looking library mechanism. Obtain explicit approval for those changes before implementing them.
- Preserve persistence and serialization compatibility by default. Storage keys, field names, selected fields, data shapes, default values, clone/serialization mechanisms, load order, save timing, and failure behavior are observable contracts even when they are not part of the TypeScript API.
- When strict typing conflicts with a legacy implementation, first preserve behavior with the narrowest sound typing adaptation. Do not use the type-system fix as a reason to restructure adjacent logic or alter runtime semantics.
- When a legacy module is selected for migration, migrate the complete cohesive module by default, including its externally used exports, meaningful comments, associated types, and relevant tests.
- Do not migrate only the immediately required exports from a cohesive legacy module merely to minimize the current dependency graph.
- Before partially migrating a legacy module, inventory all of its exports and consumers and determine whether the file contains one cohesive responsibility or several unrelated responsibilities.
- If a legacy file clearly combines unrelated responsibilities, propose an explicit split that maps every legacy export to its intended destination.
- Obtain approval before splitting a legacy module when the split changes ownership, naming, discoverability, public imports, or the expected migration sequence.
- When migrating a module intact would materially expand the task, explain the dependency expansion and obtain direction rather than silently extracting a subset.
- Preserve observable behavior and validated domain rules from the old system unless the task explicitly changes them. Add focused characterization or regression tests when migration could alter meaningful behavior.
- Before editing a legacy module, create a preservation checklist covering exports, meaningful comments, persistence/serialization behavior, side effects, timing, mutation and clone semantics, defaults, error handling, and externally visible keys or identifiers. Verify that checklist against the final diff.
- When old code spans multiple responsibilities, prefer an approved explicit split along the current architectural boundaries. Do not split it solely to minimize the textual diff or immediate dependency graph.
- Remove obsolete compatibility scaffolding, dead code, and old-system naming created solely by the migration once it is no longer required, while avoiding unrelated cleanup.
- In migration summaries, report important structural decisions, behavior intentionally preserved, behavior intentionally changed, and old patterns that were not carried forward. Include an old-to-new export map whenever a legacy module was renamed, split, consolidated, or only partially migrated.
- If no behavior or documentation change was explicitly approved, the migration summary must say that behavior and meaningful comments were preserved. If that statement cannot be made truthfully, stop and obtain approval rather than completing the migration.

# Workflow

Before modifying code:

- If a task would significantly change the project’s architecture, explain the proposed approach and obtain approval before implementing it, unless the requested task clearly authorizes the architectural change or asks for autonomous implementation.
- When ambiguity could materially affect architecture, public APIs, persisted data, or observable behavior, ask for clarification. Otherwise, make the smallest reasonable assumption and report it.
- Read this file and any more specific `AGENTS.md` between the repository root and the target files.
- Inspect the relevant code and tests and identify existing patterns.
- For broad or architectural work, explain the intended approach before extensive changes unless immediate implementation was explicitly requested.

While modifying code:

- Keep the change narrowly scoped and add or update tests alongside it.
- Do not modify unrelated files or overwrite intentional user changes.
- Run the repository formatting command only when its scope will not modify unrelated files; otherwise format only changed files using the configured formatter.

Validation should be proportional to the scope of the change. Run broader checks when shared types, build configuration, routing, workers, or application-wide behavior are affected:

1. Format changed files with the configured formatter, or run `npm run format` when its scope will not modify unrelated files.
2. `npm run lint`
3. Relevant unit tests with `npm run test:unit -- <arguments>` and, when practical, the full `npm run test:unit -- --run` suite
4. `npm run type-check`
5. `npm run build`
6. `npm run test:e2e` when the task affects a complete user workflow

Report which commands ran and whether they passed. Use only scripts that exist in `package.json`; mention a missing command instead of inventing one. Note that the current formatting script targets only `src/`.

# Environment Workarounds

- On Windows, if PowerShell blocks `npm.ps1` or `npx.ps1`, use `npm.cmd` and `npx.cmd`. Do not change the system execution policy merely to run project commands.
- Inside the Codex sandbox, Playwright Firefox may fail to spawn its tab subprocess. For Firefox commands run inside Codex only, set `MOZ_DISABLE_CONTENT_SANDBOX=1` for that command. Do not persist this variable, add it to normal project configuration, or use it for ordinary local or CI testing. Codex's outer sandbox remains active.
- Verify Playwright browsers with `npx.cmd playwright install --list` before assuming an executable is missing.

# Git and Safety

- Do not commit, push, reset, rebase, delete branches, or rewrite history unless explicitly instructed.
- Do not discard uncommitted user changes.
- Do not modify environment files, credentials, tokens, or secrets, and never add secrets to tracked files.
- Do not make destructive changes merely to resolve a test or build failure.
- Verify that generated-file changes are expected before keeping them.
- Do not install, update, or remove dependencies unless the task requires it or the user explicitly approves it.

# Definition of Done

A task is complete only when:

- The requested behavior is implemented using the established architecture.
- Types remain strict and IntelliSense is preserved.
- Relevant tests are added or updated.
- Applicable formatting, linting, type checking, tests, and build checks pass.
- No unrelated files changed.
- Documentation is updated where necessary.
- Assumptions, limitations, and checks that could not be run are clearly reported.
