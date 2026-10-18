const allowedCaseTypes = new Set(["register_safe", "search_person"]);

function isE164(value) {
  return typeof value === "string" && /^\+[1-9]\d{7,14}$/.test(value.trim());
}

function optionalString(value) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function normalizeText(value) {
  return String(value || "")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9\u3400-\u9fff]+/g, " ")
    .trim();
}

function normalizePhone(value) {
  return String(value || "").replace(/\D/g, "");
}

function tokenOverlap(left, right) {
  const a = new Set(normalizeText(left).split(" ").filter(Boolean));
  const b = new Set(normalizeText(right).split(" ").filter(Boolean));
  if (!a.size || !b.size) return 0;
  let common = 0;
  for (const token of a) if (b.has(token)) common += 1;
  return common / Math.max(a.size, b.size);
}

function matchScore(left, right) {
  if (!left || !right || left.case_type === right.case_type) return { score: 0, reasons: [] };
  const reasons = [];
  let score = 0;
  const leftName = normalizeText(left.person_name);
  const rightName = normalizeText(right.person_name);
  const nameOverlap = tokenOverlap(left.person_name, right.person_name);
  if (leftName && leftName === rightName) { score += 65; reasons.push("exact_name"); }
  else if (nameOverlap >= 0.75) { score += 48; reasons.push("similar_name"); }
  else if (nameOverlap >= 0.5) { score += 30; reasons.push("partial_name"); }

  const phones = [left.person_phone, left.contact_number].map(normalizePhone).filter(Boolean);
  const otherPhones = [right.person_phone, right.contact_number].map(normalizePhone).filter(Boolean);
  if (phones.some(phone => otherPhones.includes(phone))) { score += 30; reasons.push("matching_phone"); }

  const locationOverlap = tokenOverlap(left.person_location_approx || left.person_location, right.person_location_approx || right.person_location);
  if (locationOverlap >= 0.75) { score += 15; reasons.push("matching_location"); }
  else if (locationOverlap >= 0.4) { score += 8; reasons.push("similar_location"); }
  return { score: Math.min(100, score), reasons };
}

function findBestReunificationMatch(record, candidates, threshold = 60) {
  let best = null;
  for (const candidate of candidates || []) {
    if (!candidate || candidate.id === record.id) continue;
    const result = matchScore(record, candidate);
    if (result.score < threshold || (best && result.score <= best.score)) continue;
    best = { case: candidate, score: result.score, reasons: result.reasons };
  }
  return best;
}

function validateReunificationCase(input) {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    return "invalid_json_body";
  }

  if (input.immediate_danger === true) {
    return "emergency_escalation_required";
  }

  if (!allowedCaseTypes.has(input.case_type)) {
    return "invalid_case_type";
  }

  if (typeof input.person_name !== "string" || !input.person_name.trim()) {
    return "person_name_required";
  }

  if (!isE164(input.contact_number)) {
    return "valid_e164_contact_number_required";
  }

  if (input.person_phone !== undefined && input.person_phone !== null && !isE164(input.person_phone)) {
    return "invalid_person_phone";
  }

  if (input.consent_to_contact !== true) {
    return "contact_consent_required";
  }

  if (input.case_type === "register_safe" && input.consent_to_share_status !== true) {
    return "safe_status_sharing_consent_required";
  }

  return null;
}

function buildReunificationRecord(input) {
  return {
    case_type: input.case_type,
    person_name: input.person_name.trim(),
    person_location_approx: optionalString(input.person_location),
    person_phone: optionalString(input.person_phone),
    contact_number: input.contact_number.trim(),
    preferred_language: optionalString(input.preferred_language) || "en",
    consent_to_contact: true,
    consent_to_share_status: input.consent_to_share_status === true,
    status: "queued",
    source_call_id: optionalString(input.source_call_id),
    metadata: {
      source: "retell_conversation_flow"
    }
  };
}

module.exports = {
  buildReunificationRecord,
  findBestReunificationMatch,
  matchScore,
  normalizeText,
  validateReunificationCase
};
