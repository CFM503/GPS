import test from 'node:test';
import assert from 'node:assert';
import {
  wgs84ToGcj02,
  gcj02ToWgs84,
  wgs84ToBd09,
  bd09ToWgs84,
  calculateDistanceMeters,
  calculateBearing,
  formatMilepost,
  parseMilepost,
  calculatePointMilepost
} from '../dist/index.js';

test('Coordinate transformations: WGS84 <-> GCJ02 roundtrip precision', () => {
  const originalLng = 113.250000;
  const originalLat = 23.100000;

  const [gcjLng, gcjLat] = wgs84ToGcj02(originalLng, originalLat);
  assert.notStrictEqual(gcjLng, originalLng, 'GCJ02 should shift longitude in China');
  assert.notStrictEqual(gcjLat, originalLat, 'GCJ02 should shift latitude in China');

  const [revertedLng, revertedLat] = gcj02ToWgs84(gcjLng, gcjLat);
  const diffDistance = calculateDistanceMeters([originalLng, originalLat], [revertedLng, revertedLat]);
  assert.ok(diffDistance < 0.5, `Reverted point should be within 0.5m of original (actual: ${diffDistance}m)`);
});

test('Coordinate transformations: WGS84 <-> BD09 roundtrip precision', () => {
  const originalLng = 113.330000;
  const originalLat = 23.245000;

  const [bdLng, bdLat] = wgs84ToBd09(originalLng, originalLat);
  const [revertedLng, revertedLat] = bd09ToWgs84(bdLng, bdLat);
  const diffDistance = calculateDistanceMeters([originalLng, originalLat], [revertedLng, revertedLat]);
  assert.ok(diffDistance < 0.5, `BD09 reverted point should be within 0.5m of original (actual: ${diffDistance}m)`);
});

test('Spatial calculation: Distance and bearing', () => {
  const p1: [number, number] = [113.250000, 23.100000];
  const p2: [number, number] = [113.250000, 23.109000]; // ~1km directly north

  const dist = calculateDistanceMeters(p1, p2);
  assert.ok(dist > 990 && dist < 1010, `Distance should be ~1000m (actual: ${dist})`);

  const bearing = calculateBearing(p1, p2);
  assert.ok(Math.abs(bearing - 0) < 1.0, `Bearing directly north should be ~0 deg (actual: ${bearing})`);
});

test('Milepost formatting and parsing', () => {
  assert.strictEqual(formatMilepost(127350), 'K127+350');
  assert.strictEqual(formatMilepost(120000), 'K120+000');
  assert.strictEqual(formatMilepost(9050), 'K9+050');

  assert.strictEqual(parseMilepost('K127+350'), 127350);
  assert.strictEqual(parseMilepost('K9+050'), 9050);
  assert.strictEqual(parseMilepost('127+350'), 127350);
});

test('Spatial calculation: Point-to-centerline projection for G105 road', () => {
  const centerline: [number, number][] = [
    [113.250000, 23.100000],
    [113.265000, 23.125000],
    [113.280000, 23.150000],
    [113.295000, 23.180000],
    [113.310000, 23.210000]
  ];
  const startMilepostMeters = 120000; // K120+000

  // Asset located slightly to the right of the road center line
  const assetGps: [number, number] = [113.250500, 23.100200];
  const result = calculatePointMilepost(assetGps, centerline, startMilepostMeters);

  assert.ok(result.milepostMeters >= 120000, 'Projected milepost should be >= start milepost');
  assert.ok(result.distanceToCenterlineMeters < 100, 'Should be within 100 meters of centerline');
  assert.ok(result.milepostStr.startsWith('K120+'), `Should format as K120+xxx (actual: ${result.milepostStr})`);
});
