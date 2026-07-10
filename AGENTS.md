# Project Overview

- This is a Vue 3 application built with Vite and TypeScript.
- Use the Vue Composition API and `<script setup lang="ts">` in single-file components.
- The application may eventually support SSR. Keep reusable logic independent of browser-only APIs where practical.
- Three.js and editor-related functionality will primarily run on the client.
- Use custom UI components rather than Vuetify or another full UI framework.

# Core Dependencies

- Runtime dependencies include Vue 3, Vue Router, Pinia, `pinia-plugin-persistedstate`, VueUse (`@vueuse/core`), Three.js, and `@mdi/js`.
- Testing uses Vitest with jsdom, Vue Test Utils for component tests, and Playwright for end-to-end tests.
- `unplugin-auto-import` is installed as a development dependency but is not currently configured in `vite.config.ts`; do not assume auto-imports are active.

# TypeScript Standards

- Use strict TypeScript. The project extends the strict Vue TypeScript configuration and enables `noUncheckedIndexedAccess` for application code.
- Never introduce `any`. If a solution appears to require it, first seek a properly typed alternative. Ask for guidance only when no sound alternative is available.
- Do not use `as unknown` or double assertions merely to bypass the type system. Use them only at unavoidable external boundaries, with a concise explanation and the narrowest possible scope.
- Preserve type inference and IntelliSense. Prefer explicit reusable types over repeated inline object shapes.
- Avoid unnecessary type assertions and do not suppress errors with `@ts-ignore`.
- Use `@ts-expect-error` only when the error is intentional, documented, and tested.
- Give public functions, composables, stores, and component contracts clear types.
- Keep runtime validation separate from compile-time typing when both are needed.

# Vue Standards

- Use the Composition API and `<script setup lang="ts">`.
- Prefer `ref`, `computed`, and focused composables over large component scripts.
- Keep business logic out of presentation components and move reusable stateful logic into composables.
- Use Pinia for shared application state, not as a substitute for local component state.
- Prefer setup-style Pinia stores: `defineStore(id, () => {})`.
- Do not destructure reactive objects in ways that break reactivity; use `storeToRefs` where appropriate.
- Prefer computed values or explicit events to watchers when they express the behavior more clearly.
- Clean up event listeners, observers, animation frames, workers, and other resources when components unmount.

# Auto-Import Conventions

- `unplugin-auto-import` is intentionally installed, but no auto-import plugin configuration or generated declaration file currently exists.
- Inspect `vite.config.ts` and any generated declarations before assuming an API is auto-imported.
- Until auto-import is configured, retain the explicit imports used by the existing source.
- If auto-import is configured later, do not add explicit imports for configured APIs without a concrete technical reason, and do not assume symbols outside the configuration are available.
- Keep generated declaration files tracked or ignored according to the repository configuration and never edit them manually.

# Component Standards

- Reusable components currently belong in `src/components`. The repository does not yet have a dedicated base-UI subdirectory; follow an established local structure rather than inventing one for a single component.
- Keep UI components focused, reusable, and presentational where practical. Prefer controlled components using props and emitted events.
- Low-level reusable UI components must not import application stores. Feature-specific components may use stores only when that dependency is part of their documented responsibility.
- Prefer semantic native HTML and avoid unnecessary wrappers.
- Accessibility is required: support keyboard interaction, focus behavior, labels, disabled states, and appropriate ARIA attributes where native semantics are insufficient.
- Prefer CSS custom properties and deliberate component variants over duplicate implementations.
- Keep component APIs small. Use `defineModel` when the component genuinely exposes a model contract; otherwise use explicit props and emits.
- Add meaningful Vitest and Vue Test Utils tests for reusable UI components when they expose behavior, state, interaction, accessibility requirements, or a public contract. Cover public behavior such as props, rendering, emitted events, keyboard interaction, disabled behavior, model updates, and accessibility attributes.
- Avoid tests coupled to private implementation details and avoid large snapshots.

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
- Add tests for new reusable utilities, composables, stores, and UI components when they contain meaningful logic, behavior, edge cases, or public contracts.
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
