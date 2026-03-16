# Kanban Board Project Progress and Workflow

This document summarizes what is completed vs not completed, and explains how the current folders and files are intended to work together.

## 1) Progress Snapshot (Done vs Not Done)

Assessment date: 2026-03-16

### Completed

- Project scaffolding and strict TypeScript setup are in place.
- UI primitives exist in src/components/ui:
  - Button
  - Card
  - AutoTextarea
  - Input
  - IconButton
  - Modal
- UI props/interfaces are centralized in src/types/ui.ts.
- Basic UI demo integration exists in src/App.tsx.
- Board domain types are implemented in src/types/board.ts.
- Zustand board store is implemented with CRUD actions in src/store/boardStore.ts.
- Undo/Redo snapshot history is implemented using structuredClone.
- Persist middleware is configured for localStorage.
- Type guard-based hydration validation is implemented in src/utils/boardGuards.ts.
- Typecheck/lint currently pass.

### Partially Completed

- State layer is built, but app UI is still using local component state in App.tsx instead of useBoardStore.
- Day 12 architecture exists, but is not fully wired to Day 13 drag-and-drop UI.
- app/ (layout.tsx, page.tsx) exists, but Vite entry currently uses App.tsx.

### Not Completed Yet (Major Buckets)

- Board feature screens/components under src/components/board and src/features/board are not implemented.
- Drag and drop flow (DndContext, sortable columns/tasks) is not implemented.
- Search/filter, debounce autosave, optimistic updates, and dark mode are not implemented.
- Deployment case-study README and CI workflow are not implemented in this project folder.

### Rough Completion Estimate

- Foundation + UI kit + typed state model: mostly done
- End-to-end Kanban behavior (board UI + DnD + polish): not done
- Overall project completion estimate: about 45%

## 2) Folder Workflow (How Pieces Connect)

### src/main.tsx

- App entry point.
- Mounts React app and renders App component.
- Imports global CSS.

### src/App.tsx

- Current integration/demo page for UI primitives.
- Shows controlled input workflow and modal composition.
- Uses temporary local task state, not boardStore yet.

### src/components/ui

Reusable presentation primitives used across features:

- Button.tsx: variant/size button with loading support.
- Card.tsx: surface container for content blocks.
- AutoTextarea.tsx: textarea with auto-resize and Enter submit handling.
- Input.tsx: labeled input with hint/error and intent/size variants.
- IconButton.tsx: icon-only button with accessible label.
- Modal.tsx: dialog wrapper with escape/overlay close and focus handling.

Workflow intent:
- Feature components (board/auth) should compose these primitives.
- Business logic should stay outside UI primitives.

### src/types

- board.ts: domain model contracts (Task, Column, BoardState, IDs, actions).
- ui.ts: props contracts for UI primitives.

Workflow intent:
- Add/adjust contracts here first.
- Implement or update components/store against these contracts.

### src/store/boardStore.ts

Central board state engine (Zustand + Immer + Persist).

- Holds normalized board data: tasks, columns, columnOrder.
- Exposes CRUD actions for tasks/columns.
- Keeps history snapshots for undo/redo.
- Persists state into localStorage key: kanban-board-storage.
- Validates restored persisted data via boardGuards before merging.

Workflow intent:
- Board UI should read/write this store directly.
- App.tsx local task state should be replaced with boardStore selectors/actions.

### src/utils/boardGuards.ts

Runtime safety for persisted data.

- Parses unknown persisted payload into a valid BoardState.
- Validates task/column structures and date fields.
- Rejects invalid data and falls back to default state.

Workflow intent:
- Any unknown external data (storage/API) should be validated through guards.

### src/features

- auth/ and board/ folders exist but are currently empty.

Workflow intent:
- Put feature-specific hooks, state selectors, and view logic here.
- Keep shared reusable UI in src/components/ui.

### src/components/board

- Folder exists but currently empty.

Workflow intent:
- Add BoardView, Column, TaskCard, SortableTaskCard here.
- These components should consume useBoardStore and ui primitives.

### src/hooks and src/lib

- Currently empty.

Workflow intent:
- hooks/: custom hooks (useDebounce, useOptimisticUpdate, useDarkMode).
- lib/: wrappers/integrations for third-party logic.

## 3) Suggested Next Implementation Order

1. Build board components in src/components/board and wire to useBoardStore.
2. Replace App.tsx local state with store-driven board state.
3. Implement dnd-kit drag-and-drop in board feature.
4. Add debounce autosave + optimistic update hooks.
5. Add dark mode and performance memoization passes.
6. Add CI workflow and project README case-study.

## 4) Quick Checklist You Can Reuse

- [x] UI primitives exist
- [x] UI props typed in src/types/ui.ts
- [x] Board state model typed in src/types/board.ts
- [x] Board store CRUD implemented
- [x] Undo/Redo snapshots implemented
- [x] Persist + type-guard hydration implemented
- [ ] Board feature components implemented
- [ ] Drag and drop implemented
- [ ] Polish/performance features implemented
- [ ] Deployment/CI documentation completed
