const {
  buildReunificationRecord,
  findBestReunificationMatch,
  validateReunificationCase
} = require("../../lib/reunification");
const {
  insertReunificationCase,
  listReunificationCases,
  updateReunificationCase
} = require("../../lib/supabase");

function isAuthorized(request) {
  const configuredKey = process.env.RETELL_CALLBACK_API_KEY;
  if (!configuredKey) return false;
  return request.headers.authorization === `Bearer ${configuredKey}`;
}

module.exports = async function handler(request, response) {
  if (request.method !== "POST") {
    response.setHeader("Allow", "POST");
    return response.status(405).json({ success: false, error: "method_not_allowed" });
  }

  if (!isAuthorized(request)) {
    return response.status(401).json({ success: false, error: "unauthorized" });
  }

  const validationError = validateReunificationCase(request.body);
  if (validationError) {
    const status = validationError === "emergency_escalation_required" ? 409 : 400;
    return response.status(status).json({ success: false, error: validationError });
  }

  try {
    const record = buildReunificationRecord(request.body);
    const saved = await insertReunificationCase(record);
    let match = null;
    try {
      const cases = await listReunificationCases(200);
      const current = { ...record, ...saved };
      const best = findBestReunificationMatch(current, cases.filter(row => !["resolved", "closed"].includes(row.status)));
      if (best) {
        const matchedAt = new Date().toISOString();
        const currentMatch = {
          case_id: best.case.id,
          reference_code: best.case.reference_code,
          case_type: best.case.case_type,
          person_name: best.case.person_name,
          person_location: best.case.person_location_approx,
          contact_number: best.case.contact_number,
          score: best.score,
          reasons: best.reasons,
          matched_at: matchedAt
        };
        const reverseMatch = {
          case_id: saved.id,
          reference_code: saved.reference_code,
          case_type: record.case_type,
          person_name: record.person_name,
          person_location: record.person_location_approx,
          contact_number: record.contact_number,
          score: best.score,
          reasons: best.reasons,
          matched_at: matchedAt
        };
        await Promise.all([
          updateReunificationCase(saved.id, { metadata: { ...record.metadata, match: currentMatch, notification_status: "ready_for_retell" } }),
          updateReunificationCase(best.case.id, { metadata: { ...(best.case.metadata || {}), match: reverseMatch, notification_status: "ready_for_retell" } })
        ]);
        match = currentMatch;
      }
    } catch (matchError) {
      console.error("Unable to match reunification case", { code: matchError.code || "match_failed", status: matchError.status || null });
    }
    return response.status(201).json({
      success: true,
      case_id: saved.id,
      reference_code: saved.reference_code,
      case_type: saved.case_type,
      status: match ? "matched" : saved.status,
      created_at: saved.created_at,
      match_found: !!match,
      match,
      notification_status: match ? "ready_for_retell" : "not_applicable"
    });
  } catch (error) {
    console.error("Unable to create reunification case", {
      code: error.code || "unknown_error",
      status: error.status || null
    });
    return response.status(500).json({
      success: false,
      error: error.code || "internal_error"
    });
  }
};
