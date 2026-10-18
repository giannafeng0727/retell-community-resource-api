const {
  buildReunificationRecord,
  findBestReunificationMatch
} = require("../../lib/reunification");
const {
  insertReunificationCase,
  listReunificationCases,
  updateReunificationCase
} = require("../../lib/supabase");

const sourceCallId = "demo-family-match-20261017";
const targetReference = "FAM-ECC47B327E";

module.exports = async function handler(request, response) {
  if (request.method !== "POST") {
    response.setHeader("Allow", "POST");
    return response.status(405).json({ success: false, error: "method_not_allowed" });
  }

  response.setHeader("Cache-Control", "no-store, max-age=0");

  try {
    let cases = await listReunificationCases(200);
    const safeCase = cases.find(row => row.reference_code === targetReference && row.case_type === "register_safe");
    if (!safeCase) return response.status(404).json({ success: false, error: "demo_target_not_found" });

    const record = {
      ...buildReunificationRecord({
        case_type: "search_person",
        person_name: safeCase.person_name,
        person_location: safeCase.person_location_approx,
        contact_number: "+13105550199",
        preferred_language: safeCase.preferred_language || "en",
        consent_to_contact: true,
        consent_to_share_status: false,
        immediate_danger: false,
        source_call_id: sourceCallId
      }),
      metadata: { source: "demo_seed", simulation: true }
    };

    let demoCase = cases.find(row => row.source_call_id === sourceCallId);
    if (!demoCase) {
      const saved = await insertReunificationCase(record);
      demoCase = { ...record, ...saved };
      cases = await listReunificationCases(200);
    }

    const best = findBestReunificationMatch(demoCase, cases.filter(row => !["resolved", "closed"].includes(row.status)));
    if (!best || best.case.id !== safeCase.id) {
      return response.status(409).json({ success: false, error: "demo_match_not_found" });
    }

    const matchedAt = new Date().toISOString();
    const matchForDemo = {
      case_id: safeCase.id,
      reference_code: safeCase.reference_code,
      case_type: safeCase.case_type,
      person_name: safeCase.person_name,
      person_location: safeCase.person_location_approx,
      contact_number: safeCase.contact_number,
      score: best.score,
      reasons: best.reasons,
      matched_at: matchedAt
    };
    const matchForSafeCase = {
      case_id: demoCase.id,
      reference_code: demoCase.reference_code,
      case_type: demoCase.case_type,
      person_name: demoCase.person_name,
      person_location: demoCase.person_location_approx,
      contact_number: demoCase.contact_number,
      score: best.score,
      reasons: best.reasons,
      matched_at: matchedAt
    };

    await Promise.all([
      updateReunificationCase(demoCase.id, {
        metadata: { ...(demoCase.metadata || record.metadata), match: matchForDemo, notification_status: "ready_for_retell" }
      }),
      updateReunificationCase(safeCase.id, {
        metadata: { ...(safeCase.metadata || {}), match: matchForSafeCase, notification_status: "ready_for_retell" }
      })
    ]);

    return response.status(200).json({
      success: true,
      created_or_reused: demoCase.reference_code,
      matched_with: safeCase.reference_code,
      score: best.score
    });
  } catch (error) {
    console.error("Unable to seed family demo", { code: error.code || "unknown_error", status: error.status || null });
    return response.status(500).json({ success: false, error: error.code || "internal_error" });
  }
};
