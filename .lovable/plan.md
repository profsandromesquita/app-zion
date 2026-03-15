

# Plano: Fix Session Resume Step Logic

## Bug Analysis

The `inferStepFromSession` logic (line 84-93) is already correct. The real bug is in `loadMission`:

1. When `loadMission` runs, if `sessionId` is null (React state not yet updated from Step 1), the mission loads into component state but the `mission_id` is NOT saved to DB (line 306: `if (selected && sessionId)`)
2. The `mission` guard (line 255: `if (!userPhase || missionLoading || mission) return`) prevents re-running, so `mission_id` never gets saved
3. On page reload, DB has `mission_id = null`, so `inferStepFromSession` returns 2 correctly — BUT if the user had clicked "Iniciar missão" without the DB save, and there's a different timing issue, a new random mission gets selected

## Fix

### `src/pages/Session.tsx`

**Change 1**: Add a `useEffect` that saves `mission_id` to DB whenever both `mission` and `sessionId` are available (covers the race condition):

```typescript
useEffect(() => {
  if (mission?.id && sessionId) {
    supabase
      .from("io_daily_sessions")
      .update({ mission_id: mission.id })
      .eq("id", sessionId)
      .then(() => {});
  }
}, [mission, sessionId]);
```

**Change 2**: In `loadMission`, remove the `sessionId` guard for saving (since the effect above handles it), keeping the function focused on loading only.

**Change 3**: Restore saved scales from existing session on resume (lines 190-203) — add hydration for `scales` state from the existing session's `escala_*` columns, and `feedback`/`reforco` if present.

This ensures:
- Mission is always persisted to DB as soon as both values are available
- Same mission is shown on resume instead of random re-selection
- All step data is properly hydrated on resume

