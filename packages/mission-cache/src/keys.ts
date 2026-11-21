/** The query keys of one mission's data, the same in Command and Field, so shared events find their lists. */
export const missionDataKeys = {
  mission: (missionId: string) => ['missions', missionId] as const,
  polygons: (missionId: string) => ['missions', missionId, 'polygons'] as const,
  reports: (missionId: string) => ['missions', missionId, 'reports'] as const,
  messages: (missionId: string) => ['missions', missionId, 'messages'] as const,
  sos: (missionId: string) => ['missions', missionId, 'sos'] as const,
};
