

# Fix IOJourneySection — 2 bugs

## Bug 1: Days calculation (line 92-97)
The `daysDiff` function logic is correct mathematically, but `phaseData?.phase_entered_at` may be null/undefined, causing fallback to `created_at` which may also be null, resulting in the default return of `1`. 

**Fix**: Add `+1` to include both start and end day (inclusive counting), and ensure the date string is being parsed correctly by trimming timezone issues:

```typescript
function daysDiff(dateStr: string | null): number {
  if (!dateStr) return 1;
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return 1;
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const days = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
  return Math.max(1, days);
}
```

Using `Math.ceil` instead of `Math.floor` to count partial days as full days (more intuitive for users).

## Bug 2: Pluralization (line 379)
Current: `sessão{totalSessions !== 1 ? "ões" : ""}` → produces "sessãoões"

**Fix**: 
```tsx
{totalSessions === 1 ? "sessão" : "sessões"} em {daysInPhase} dia{daysInPhase !== 1 ? "s" : ""}
```

## File changed
- `src/components/profile/IOJourneySection.tsx` (lines 92-97 and 379)

