const PROJECT_STATUS_ORDER: Record<string, number> = {
  active: 0, paused: 1, done: 2, planned: 3, canceled: 4,
};

export const PROJECT_STATUS_LABELS: Record<string, string> = {
  planned: 'Planned', active: 'Active', paused: 'Paused', done: 'Done', canceled: 'Canceled',
};

export const sortProjectsByStatus = <T extends { name: string; status: string }>(projects: T[]): T[] =>
  [...projects].sort((a, b) => {
    const orderDiff = (PROJECT_STATUS_ORDER[a.status] ?? 99) - (PROJECT_STATUS_ORDER[b.status] ?? 99);
    return orderDiff !== 0 ? orderDiff : a.name.localeCompare(b.name);
  });
