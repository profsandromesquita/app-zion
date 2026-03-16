

# Fix: Shadow Mode table rows not clickable

## Problem
The Shadow Mode comparison table (`TableRow` at line 443) lacks an `onClick` handler and `cursor-pointer` class. The main "Usuários" table below already works correctly.

## Fix
Add `onClick` and `cursor-pointer` to the Shadow Mode `TableRow` (line 443):

```tsx
<TableRow
  key={d.id}
  className="cursor-pointer hover:bg-muted/50"
  onClick={() => {
    setSelectedUser(d);
    setPmResult(null);
    setOverridePhase(d.current_phase || 1);
  }}
>
```

## File changed
- `src/pages/admin/IOOverview.tsx` (line 443 only)

