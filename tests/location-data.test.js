const test = require("node:test");
const assert = require("node:assert/strict");
const { TR_PROVINCES, TR_DISTRICTS, validateTurkeyLocations } = require("../turkey-locations.js");

test("Türkiye location data has 81 uniquely numbered provinces", () => {
  assert.equal(TR_PROVINCES.length, 81);
  assert.equal(new Set(TR_PROVINCES.map((p) => p.plate)).size, 81);
  assert.deepEqual(TR_PROVINCES.map((p) => p.plate).sort((a, b) => a - b), Array.from({ length: 81 }, (_, i) => i + 1));
});

test("every province has valid district coordinates", () => {
  assert.deepEqual(validateTurkeyLocations(), []);
  TR_PROVINCES.forEach((province) => assert.ok(TR_DISTRICTS[province.plate].length, province.name));
});

test("district coordinates remain reasonably close to their province", () => {
  const toRad = (n) => n * Math.PI / 180;
  const distance = (a, b) => {
    const dLat = toRad(b[1] - a.lat), dLng = toRad(b[2] - a.lng);
    const x = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b[1])) * Math.sin(dLng / 2) ** 2;
    return 6371 * 2 * Math.asin(Math.sqrt(x));
  };
  TR_PROVINCES.forEach((province) => TR_DISTRICTS[province.plate].forEach((district) => {
    assert.ok(distance(province, district) < 250, `${province.name}/${district[0]} coordinate is implausibly far away`);
  }));
});
