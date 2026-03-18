# Documentation

Last updated: 2026-03-18

## 1) Current Project Status

### Completed

- Strict TypeScript project setup with no explicit any usage in app code.
- UI primitives are implemented in src/components/ui:
  - Button
  - Card
  - AutoTextarea
  - Input
  - IconButton
  - Modal
- UI prop contracts are centralized in src/types/ui.ts.
- Domain and state contracts are centralized in src/types/board.ts.
- Board store is implemented in src/store/boardStore.ts with:
  - task and column CRUD actions
  - undo/redo history snapshots
  - persist middleware storage
  - persistence hydration validation through board guards
- Runtime validation utilities are implemented in src/utils/boardGuards.ts.
- Board feature files are wired and compiling:
  - src/features/board/BoardView.tsx
  - src/components/board/Column.tsx
  - src/components/board/TaskCard.tsx
- Day 14 polish features implemented in code:
  - debounced task auto-save (useDebouncedCallback)
  - framer-motion task animations
  - dark mode hook using system preference detection with persisted manual override
  - useMemo-based task filtering and derived board data
  - class-driven Tailwind dark variant wired to the `dark` root class
  - modal and input dark-mode surface styling for Create Column and Delete Column dialogs
- Day 3 concept integration implemented in code:
  - async queue utility in src/utils/asyncQueue.ts
  - queued mock remote save path in src/lib/taskApi.ts

### In Progress / Partial

- Optimistic updates with rollback are implemented in task editing flow, but still need full end-to-end UX validation under simulated failures.
- DnD behavior compiles, but full production-grade interactions and keyboard behavior still need manual testing and polish.

### Not Done Yet

- React DevTools performance profiling pass is not documented as completed yet.
- Deployment docs/case-study and CI pipeline are still pending.

## 2) Deliverables Snapshot (Day 14 Focus)

- [x] Auto-save debounced (no rapid API calls)
- [x] Optimistic updates with rollback on error (implemented)
- [x] Smooth animations for movement (task-level framer-motion)
- [x] Dark mode with system preference detection
- [ ] Performance profiled with React DevTools

## 3) Folder Workflow (How Files Connect)

### src/types

- board.ts defines core domain contracts (Task, Column, BoardState, IDs).
- ui.ts defines reusable UI component prop contracts.

Workflow:
- Define/change data and prop contracts first.
- Keep components and store aligned to these shared contracts.

### src/store

- boardStore.ts is the source of truth for board state.
- Handles CRUD, history snapshots, undo/redo, and persistence merge.

Workflow:
- Feature and board components read/write through useBoardStore selectors/actions.

### src/utils

- boardGuards.ts validates unknown persisted payloads.
- asyncQueue.ts limits concurrent async operations.

Workflow:
- Use guards for any unknown external data.
- Use AsyncQueue for throttled or rate-limited async sync behavior.

### src/lib

- taskApi.ts provides mock async remote update behavior.

Workflow:
- Keep API wrappers in lib, call them from hooks/components via typed interfaces.

### src/hooks

- useDebounce.ts: debounced callback utility.
- useOptimisticUpdate.ts: optimistic mutation helper with rollback.
- useDarkMode.ts: system-aware dark mode state and document class sync.

Workflow:
- Place reusable behavior hooks here; keep component files focused on UI + composition.

### src/components

- ui/: reusable presentation primitives.
- board/: board-specific display and interaction components.

Workflow:
- ui components stay generic.
- board components compose ui components and connect to store actions/selectors.

### src/features

- board/BoardView.tsx coordinates drag handlers, filtering, and board composition.

Workflow:
- Keep feature orchestration in features and delegate rendering details to components.

## 4) Recommended Next Steps

1. Make BoardView the default mounted screen (replace demo-first App flow).
2. Run manual behavior QA for drag/drop edge cases and optimistic rollback scenarios.
3. Run and record React DevTools profiling and apply targeted optimizations.
4. Add deployment/case-study details and CI workflow.
