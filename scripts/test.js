const assert = require("node:assert/strict");
const { searchResources, validateRequest } = require("../lib/search");

const shelterRequest = {
  resource_type: "shelter",
  location: "Malibu Civic Center",
  coordinates: { latitude: 34.0366, longitude: -118.6874 },
  people_count: 3,
  children_count: 1,
  accessibility_required: false,
  medical_power_required: false,
  has_pet: true,
  has_service_animal: false,
  needs_transportation: false,
  preferred_language: "Spanish",
  max_distance_miles: 10
};

assert.equal(validateRequest(shelterRequest), null);
const shelterResult = searchResources(shelterRequest);
assert.equal(shelterResult.success, true);
assert.equal(shelterResult.result_count, 2);
assert.equal(shelterResult.results[0].resource_id, "malibu_civic_shelter_demo");
assert.equal(shelterResult.results[0].data_mode, "simulation");
assert.equal(shelterResult.results[0].latitude, undefined);

const inaccessibleRequest = {
  resource_type: "shelter",
  location: "Malibu",
  people_count: 999
};
const emptyResult = searchResources(inaccessibleRequest);
assert.equal(emptyResult.result_count, 0);
assert.equal(emptyResult.fallback_required, true);

const transportRequest = {
  resource_type: "transportation",
  location: "Zuma Beach",
  coordinates: { latitude: 34.0205, longitude: -118.8285 },
  people_count: 3,
  children_count: 1,
  has_pet: true,
  max_distance_miles: 5
};
const transportResult = searchResources(transportRequest);
assert.equal(transportResult.result_count, 2);
assert.equal(transportResult.results[0].resource_id, "zuma_pickup_demo");

assert.equal(validateRequest({ resource_type: "unknown", location: "90007" }), "invalid_resource_type");
assert.equal(validateRequest({ resource_type: "food", location: "" }), "location_required");

console.log("All resource search tests passed.");
