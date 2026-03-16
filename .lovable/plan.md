

# Fix: Reset state after saving diary entry

## Problem
After saving (create or update), the UI stays on the editor instead of returning to the initial view.

## Changes in `src/pages/Diary.tsx`

**Line 299-301** (after creating): Replace `setSelectedEntry(data)` with `setSelectedEntry(null)` and add `setContent('')`:
```typescript
setEntries((prev) => [data as DiaryEntry, ...prev]);
setSelectedEntry(null);
setContent('');
setIsCreating(false);
```

**Lines 324-328** (after updating): Add `setSelectedEntry(null)` and `setContent('')` after updating entries state:
```typescript
setEntries((prev) =>
  prev.map((e) =>
    e.id === selectedEntry.id ? { ...e, content: content.trim() } : e
  )
);
setSelectedEntry(null);
setContent('');
```

Both toasts remain as-is. Fire-and-forget calls to edge functions are unaffected.

## Files
- `src/pages/Diary.tsx`

