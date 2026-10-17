const assert = require("node:assert/strict");
const { searchResources, validateRequest } = require("../lib/search");

const shelterRequest = {
  resource_type: "shelter",
  location: "90007",
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
assert.equal(shelterResult.result_count, 1);
assert.equal(shelterResult.results[0].resource_id, "shelter_001");
assert.equal(shelterResult.results[0].latitude, undefined);

const inaccessibleRequest = {
  resource_type: "shelter",
  location: "90007",
  people_count: 20
};
const emptyResult = searchResources(inaccessibleRequest);
assert.equal(emptyResult.result_count, 0);
assert.equal(emptyResult.fallback_required, true);

assert.equal(validateRequest({ resource_type: "unknown", location: "90007" }), "invalid_resource_type");
assert.equal(validateRequest({ resource_type: "food", location: "" }), "location_required");

console.log("All resource search tests passed.");
