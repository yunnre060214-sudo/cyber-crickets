export function applyDueEvents(board, eventPlan, timeMs, appliedIds) {
  const events = [];
  for (const e of eventPlan) {
    if (e.timeMs > timeMs || appliedIds.has(e.id)) continue;
    appliedIds.add(e.id);
    const changes = e.changes.map((c) => ({
      ...c,
      previousValue: board.resources[c.index],
    }));
    for (const c of changes) board.resources[c.index] = c.value;
    events.push({ ...e, timeMs, changes });
  }
  return events;
}
