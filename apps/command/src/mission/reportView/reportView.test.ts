import { describe, expect, it } from 'vitest';
import {
  chipLabel,
  filterByChip,
  filterReports,
  initialReportsView,
  inspectorSub,
  listMeta,
  listTitle,
  polygonLabel,
  positionLabel,
  REPORT_CHIPS,
  reporterLabel,
  statusCounts,
  typeCounts,
} from '.';
import { mission, polygonA, reportFinding, reportHazard, reportLocated, reports } from '../fixtures';

describe('filterReports', () => {
  it('keeps every report for "all" and "all"', () => {
    expect(filterReports(reports, 'all', 'all')).toEqual(reports);
  });

  it('filters by status, by type, and by both', () => {
    expect(filterReports(reports, 'new', 'all')).toEqual([reportLocated, reportFinding]);
    expect(filterReports(reports, 'handled', 'all')).toEqual([reportHazard]);
    expect(filterReports(reports, 'all', 'hazard')).toEqual([reportHazard]);
    expect(filterReports(reports, 'new', 'hazard')).toEqual([]);
  });
});

describe('counts', () => {
  it('counts the reports by status', () => {
    expect(statusCounts(reports)).toEqual({ all: 3, new: 2, handled: 1 });
  });

  it('counts the reports by type, zero for the others', () => {
    expect(typeCounts(reports)).toEqual({ finding: 1, hazard: 1, inaccessible: 0, general: 0, located: 1 });
  });
});

describe('reporterLabel', () => {
  it('writes the callsign with its leading zero, then the name', () => {
    expect(reporterLabel(reportFinding)).toBe('04 דנה כהן');
  });

  it('writes the name alone when there is no callsign', () => {
    expect(reporterLabel({ reportedBy: { role: 'commander', name: 'ישי', callsign: null } })).toBe('ישי');
  });
});

describe('polygonLabel', () => {
  it('names the polygon', () => {
    expect(polygonLabel(reportFinding, [polygonA])).toBe('ואדי צפוני');
  });

  it('says so when the reporter had no polygon', () => {
    expect(polygonLabel(reportHazard, [polygonA])).toBe('ללא פוליגון');
  });

  it('says so when the polygon was deleted', () => {
    expect(polygonLabel(reportFinding, [])).toBe('פוליגון שנמחק');
  });
});

describe('list row', () => {
  it('titles a report by its text, and a located one by its category', () => {
    expect(listTitle(reportFinding)).toBe('כפפה אפורה ליד השביל');
    expect(listTitle(reportLocated)).toBe('הנעדר אותר');
  });

  it('describes it as type, reporter, polygon and Israel time', () => {
    expect(listMeta(reportFinding, [polygonA])).toBe('ממצא / רמז, 04 דנה כהן, ואדי צפוני, 16:44');
  });
});

describe('positionLabel', () => {
  it('writes latitude, longitude and the accuracy', () => {
    expect(positionLabel(reportFinding)).toBe('31.7742, 35.1301, ±5 מ׳');
  });

  it('leaves the accuracy out when unknown', () => {
    expect(positionLabel(reportHazard)).toBe('31.7721, 35.1252');
  });
});

describe('inspectorSub', () => {
  it('says the kind and the status', () => {
    expect(inspectorSub(reportHazard)).toBe('דיווח, טופל');
    expect(inspectorSub(reportFinding)).toBe('דיווח, חדש');
  });

  it('adds that a New located report awaits verification', () => {
    expect(inspectorSub(reportLocated)).toBe('דיווח, חדש, ממתין לאימות');
    expect(inspectorSub({ ...reportLocated, status: 'handled' })).toBe('דיווח, טופל');
  });
});

describe('the phone filter chips', () => {
  it('RV1: lists all, New, then every category except "located"', () => {
    expect(REPORT_CHIPS).toEqual(['all', 'new', 'finding', 'hazard', 'inaccessible', 'general']);
  });

  it('RV2: filters by one chip', () => {
    expect(filterByChip(reports, 'all')).toBe(reports);
    expect(filterByChip(reports, 'new')).toEqual([reportLocated, reportFinding]);
    expect(filterByChip(reports, 'hazard')).toEqual([reportHazard]);
    expect(filterByChip(reports, 'general')).toEqual([]);
  });

  it('RV3: labels the status chips with their count and the categories without one', () => {
    const counts = statusCounts(reports);
    expect(chipLabel('all', counts)).toBe('הכל 3');
    expect(chipLabel('new', counts)).toBe('חדש 2');
    expect(chipLabel('hazard', counts)).toBe('מפגע');
  });
});

describe('initialReportsView', () => {
  it('RV4: opens on the rally point, with bounds around the reports', () => {
    const view = initialReportsView({ mission, polygons: [polygonA], reports: [reportFinding] });
    const [lng, lat] = reportFinding.position.coordinates as [number, number];
    expect(view.center).toEqual(mission.rallyPoint.coordinates);
    expect(view.zoom).toBe(14);
    const [west, south, east, north] = view.bounds;
    expect(west).toBeLessThanOrEqual(lng);
    expect(east).toBeGreaterThanOrEqual(lng);
    expect(south).toBeLessThanOrEqual(lat);
    expect(north).toBeGreaterThanOrEqual(lat);
  });
});
