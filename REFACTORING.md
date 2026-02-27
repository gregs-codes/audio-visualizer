# App.tsx Refactoring Guide

This document explains the refactoring of App.tsx into modular, reusable components and custom hooks.

## Overview

The original `App.tsx` was ~1339 lines with complex state management, UI rendering, and side effects all in one file. The refactored version splits this into:

- **Presentational Components** - Focused on rendering UI
- **Custom Hooks** - Encapsulating complex logic and side effects
- **Settings Components** - Already existed, now fully integrated

## New Components

### UI Components

#### `TopBar.tsx`
- Renders the top navigation bar
- Manages server logs panel with EventSource
- Handles demo and settings button clicks
- **Props**: `onToggleSettings`, `onDemo`

#### `PlaybackControls.tsx`
- Play/pause button, audio upload, seek bar, volume indicator
- **Props**: `isPlaying`, `progress`, `volume`, `audioRef`, `onAudioFile`

#### `TimelineScroller.tsx`
- Horizontal scrollable timeline synced with audio playback
- Auto-scrolls during playback, supports manual seeking
- **Props**: `audioRef`, `isPlaying`, `progress`, `pxPerSecond`

#### `SettingsDrawer.tsx`
- Container for collapsible settings sections
- Includes `SettingsSection` component for reusable sections
- **Props**: `isOpen`, `children`

## Custom Hooks

### State Management Hooks

#### `usePlaybackState.ts`
Manages audio playback state (play/pause/ended events).

**Returns**: `{ isPlaying, progress }`

#### `useQueryParams.ts`
Parses URL query parameters and applies them to state on mount.

**Parameters**: Object with setter functions for all query-configurable state

#### `useManifestLoader.ts`
Loads animation and character manifest files from `/dance/manifest.json` and `/character/manifest.json`.

**Returns**: `{ animFiles, charFiles }`

### Export Hooks

#### `useAutoExport.ts`
Handles client-side auto-export triggered by `autoExport` state.

**Parameters**: `{ autoExport, ready, analyserNode, runExport }`

#### `useServerAutoExport.ts`
Massive hook managing server-side auto-export flow (the 200+ line useEffect from original App.tsx).

Handles:
- Query param parsing
- Audio loading from URL
- Canvas prebuffering
- Recording phases (intro → playing → outro)
- Progress tracking
- Error handling

**Parameters**: Large object with all setters and state needed for server export

### Demo Mode Hook

#### `useDemoMode.ts`
Encapsulates the demo button functionality.

**Returns**: Async function to trigger demo mode

**Functionality**:
- Loads demo audio (`/demo/demo.wav`)
- Sets demo background image
- Configures title/description overlays
- Sets rotating circular bars visualizer
- Loads 3D dancer character
- Auto-plays after setup

## Refactored App.tsx

The new `App.refactored.tsx` is ~700 lines (down from 1339) and has clear structure:

```tsx
export default function App() {
  // 1. Hooks (audio, recorder)
  const { audioRef, init, ... } = useAudioAnalyzer();
  const { start, stop } = useCanvasRecorder();

  // 2. State declarations (grouped by concern)
  // UI state, background, audio, layout, export, text overlays, dancer, server

  // 3. Custom hooks
  const { animFiles, charFiles } = useManifestLoader(...);
  const { isPlaying, progress } = usePlaybackState(...);
  useQueryParams(...);
  useAutoExport(...);
  useServerAutoExport(...);
  const handleDemo = useDemoMode(...);

  // 4. Derived state (useMemo)
  const stereo = useMemo(...);
  const analysers = useMemo(...);
  const previewSize = useMemo(...);
  const effectiveSize = useMemo(...);

  // 5. Event handlers
  const handleAudioFile = async (file) => { ... };
  const runExport = async () => { ... };
  const handleServerRender = async () => { ... };
  const handleLayoutChange = (layout) => { ... };

  // 6. JSX - Clean component composition
  return (
    <>
      <TopBar ... />
      <SettingsDrawer>
        <GeneralSettings ... />
        <PanelsSettings ... />
        <CharacterSettings ... />
        <CameraSettings ... />
        <TextOverlaySettings ... />
        <ExportSettings ... />
      </SettingsDrawer>
      <PlaybackControls ... />
      <TimelineScroller ... />
      <VisualizerPanel ... />
    </>
  );
}
```

## Migration Steps

To switch from the old App.tsx to the refactored version:

1. **Backup your current App.tsx**:
   ```bash
   cp src/App.tsx src/App.backup.tsx
   ```

2. **Replace App.tsx with the refactored version**:
   ```bash
   cp src/App.refactored.tsx src/App.tsx
   ```

3. **Verify all imports are correct** - The refactored version uses existing settings components that already exist in your codebase.

4. **Test thoroughly**:
   - Audio upload and playback
   - All visualizer modes
   - Settings panels (general, panels, character, camera, text, export)
   - Local export functionality
   - Server render functionality
   - Demo mode
   - Query param auto-export

## Benefits

### Maintainability
- **Single Responsibility**: Each component/hook has one clear purpose
- **Easier Testing**: Hooks and components can be tested independently
- **Better Organization**: Related code is grouped together

### Reusability
- TopBar, PlaybackControls, TimelineScroller can be used in other projects
- Custom hooks encapsulate complex logic for reuse

### Readability
- 50% reduction in App.tsx size
- Clear separation of concerns
- Descriptive component and hook names

### Performance
- No performance changes - same React patterns, just better organized
- useMemo usage remains the same

## File Structure

```
src/
├── App.tsx (refactored)
├── App.backup.tsx (your old version)
├── components/
│   ├── TopBar.tsx ✨ NEW
│   ├── PlaybackControls.tsx ✨ NEW
│   ├── TimelineScroller.tsx ✨ NEW
│   ├── SettingsDrawer.tsx ✨ NEW
│   ├── GeneralSettings.tsx (existing)
│   ├── PanelsSettings.tsx (existing)
│   ├── CharacterSettings.tsx (existing)
│   ├── CameraSettings.tsx (existing)
│   ├── TextOverlaySettings.tsx (existing)
│   ├── ExportSettings.tsx (updated with server render)
│   └── VisualizerPanel.tsx (existing)
└── hooks/ ✨ NEW FOLDER
    ├── useAutoExport.ts
    ├── useQueryParams.ts
    ├── usePlaybackState.ts
    ├── useManifestLoader.ts
    ├── useServerAutoExport.ts
    └── useDemoMode.ts
```

## Next Steps

Consider further improvements:
1. Extract server render logic into a custom hook (`useServerRender`)
2. Create a context provider for shared audio state
3. Add unit tests for custom hooks
4. Add Storybook stories for UI components
5. Extract constants (CUSTOM_MODES, default colors) to separate files
