const allowedResourceTypes = new Set([
  "shelter",
  "food",
  "water",
  "transportation",
  "other"
]);

const allowedLocationConfidence = new Set([
  "caller_confirmed",
  "approximate",
  "landmark",
  "unknown"
]);

function isNonNegativeInteger(value) {
  return Number.isInteger(value) && value >= 0;
}

function validateAssistanceRequest(input) {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    return "invalid_json_body";
  }

  if (input.immediate_danger === true) {
    return "emergency_escalation_required";
  }

  if (!allowedResourceTypes.has(input.resource_type)) {
    return "invalid_resource_type";
  }

  if (typeof input.caller_location !== "string" || !input.caller_location.trim()) {
    return "caller_location_required";
  }

  if (input.consent_to_callback !== true) {
    return "callback_consent_required";
  }

  if (
    typeof input.callback_number !== "string" ||
    !/^\+[1-9]\d{7,14}$/.test(input.callback_number.trim())
  ) {
    return "valid_e164_callback_number_required";
  }

  if (
    input.people_count !== undefined &&
    (!Number.isInteger(input.people_count) || input.people_count < 1)
  ) {
    return "invalid_people_count";
  }

  if (
    input.children_count !== undefined &&
    !isNonNegativeInteger(input.children_count)
  ) {
    return "invalid_children_count";
  }

  if (
    input.people_count !== undefined &&
    input.children_count !== undefined &&
    input.children_count > input.people_count
  ) {
    return "children_count_exceeds_people_count";
  }

  if (
    input.location_confidence !== undefined &&
    !allowedLocationConfidence.has(input.location_confidence)
  ) {
    return "invalid_location_confidence";
  }

  return null;
}

function calculatePriority(input) {
  let score = 0;
  const reasons = [];

  if (input.resource_type === "shelter" && input.safe_shelter_tonight === false) {
    score += 50;
    reasons.push("no_safe_shelter_tonight");
  }

  if (input.resource_type === "food" || input.resource_type === "water") {
    score += 40;
    reasons.push(`urgent_${input.resource_type}_need`);
  }

  if ((input.children_count || 0) > 0 || (input.vulnerable_people_count || 0) > 0) {
    score += 30;
    reasons.push("vulnerable_people_present");
  }

  if (input.medical_power_required === true) {
    score += 25;
    reasons.push("medical_power_required");
  }

  if (input.needs_transportation === true) {
    score += 20;
    reasons.push("transportation_barrier");
  }

  if (input.search_failure_reason) {
    score += 10;
    reasons.push("automated_match_failed");
  }

  if (input.urgency === "high") {
    score += 15;
    reasons.push("caller_reported_high_urgency");
  }

  score = Math.min(score, 1000);

  let priority = "low";
  if (score >= 80) priority = "critical";
  else if (score >= 30) priority = "high";
  else if (score > 0) priority = "normal";

  return { priority, priority_score: score, priority_reasons: reasons };
}

function buildDatabaseRecord(input) {
  const priority = calculatePriority(input);

  return {
    status: "queued",
    ...priority,
    need_type: "resource_assistance",
    resource_type: input.resource_type,
    caller_location_approx: input.caller_location.trim(),
    location_confidence: input.location_confidence || "caller_confirmed",
    people_count: input.people_count ?? null,
    children_count: input.children_count ?? 0,
    accessibility_required: input.accessibility_required === true,
    medical_power_required: input.medical_power_required === true,
    has_pet: input.has_pet === true,
    has_service_animal: input.has_service_animal === true,
    needs_transportation: input.needs_transportation === true,
    preferred_language: input.preferred_language || "en-US",
    callback_number: input.callback_number.trim(),
    consent_to_callback: true,
    search_failure_reason: input.search_failure_reason || null,
    source_call_id: input.source_call_id || null,
    matched_resource_ids: Array.isArray(input.matched_resource_ids)
      ? input.matched_resource_ids.filter((value) => typeof value === "string").slice(0, 10)
      : [],
    metadata: {
      source: "retell_conversation_flow"
    }
  };
}

module.exports = {
  buildDatabaseRecord,
  calculatePriority,
  validateAssistanceRequest
};
