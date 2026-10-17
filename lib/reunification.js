const allowedCaseTypes = new Set(["register_safe", "search_person"]);

function isE164(value) {
  return typeof value === "string" && /^\+[1-9]\d{7,14}$/.test(value.trim());
}

function optionalString(value) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
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

module.exports = { buildReunificationRecord, validateReunificationCase };
