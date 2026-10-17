const assert = require("node:assert/strict");
const {
  buildReunificationRecord,
  validateReunificationCase
} = require("../lib/reunification");

const validSearch = {
  case_type: "search_person",
  person_name: "Example Person",
  person_location: "Downtown shelter",
  person_phone: "+12025550124",
  contact_number: "+12025550123",
  preferred_language: "zh",
  consent_to_contact: true,
  consent_to_share_status: false,
  immediate_danger: false,
  source_call_id: "test-call-1"
};

assert.equal(validateReunificationCase(validSearch), null);
assert.equal(
  validateReunificationCase({ ...validSearch, immediate_danger: true }),
  "emergency_escalation_required"
);
assert.equal(
  validateReunificationCase({ ...validSearch, consent_to_contact: false }),
  "contact_consent_required"
);
assert.equal(
  validateReunificationCase({
    ...validSearch,
    case_type: "register_safe",
    consent_to_share_status: false
  }),
  "safe_status_sharing_consent_required"
);

const record = buildReunificationRecord(validSearch);
assert.equal(record.case_type, "search_person");
assert.equal(record.person_name, "Example Person");
assert.equal(record.person_location_approx, "Downtown shelter");
assert.equal(record.status, "queued");

console.log("Reunification case validation tests passed.");
