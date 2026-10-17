const assert = require("node:assert/strict");
const {
  buildDatabaseRecord,
  calculatePriority,
  validateAssistanceRequest
} = require("../lib/assistance");

const validRequest = {
  resource_type: "shelter",
  caller_location: "90007",
  callback_number: "+12135550199",
  consent_to_callback: true,
  people_count: 3,
  children_count: 1,
  safe_shelter_tonight: false,
  needs_transportation: true,
  preferred_language: "es-419",
  search_failure_reason: "no_matching_resources"
};

assert.equal(validateAssistanceRequest(validRequest), null);
assert.equal(
  validateAssistanceRequest({ ...validRequest, consent_to_callback: false }),
  "callback_consent_required"
);
assert.equal(
  validateAssistanceRequest({ ...validRequest, immediate_danger: true }),
  "emergency_escalation_required"
);

const priority = calculatePriority(validRequest);
assert.equal(priority.priority_score, 110);
assert.equal(priority.priority, "critical");
assert.deepEqual(priority.priority_reasons, [
  "no_safe_shelter_tonight",
  "vulnerable_people_present",
  "transportation_barrier",
  "automated_match_failed"
]);

const record = buildDatabaseRecord(validRequest);
assert.equal(record.status, "queued");
assert.equal(record.caller_location_approx, "90007");
assert.equal(record.preferred_language, "es-419");
assert.equal(record.callback_number, "+12135550199");

console.log("Assistance request validation and priority tests passed.");
