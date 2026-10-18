const { listReunificationCases } = require("../../lib/supabase");

function publicRecord(row) {
  return {
    id: row.id,
    reference_code: row.reference_code,
    case_type: row.case_type,
    person_name: row.person_name,
    person_location: row.person_location_approx,
    person_phone: row.person_phone,
    contact_number: row.contact_number,
    preferred_language: row.preferred_language,
    status: row.status,
    source_call_id: row.source_call_id,
    created_at: row.created_at,
    updated_at: row.updated_at
  };
}

module.exports = async function handler(request, response) {
  if (request.method !== "GET") {
    response.setHeader("Allow", "GET");
    return response.status(405).json({ success: false, error: "method_not_allowed" });
  }

  response.setHeader("Cache-Control", "no-store, max-age=0");

  try {
    const rows = await listReunificationCases(request.query?.limit);
    return response.status(200).json({
      success: true,
      cases: rows.map(publicRecord),
      fetched_at: new Date().toISOString()
    });
  } catch (error) {
    console.error("Unable to list reunification cases", {
      code: error.code || "unknown_error",
      status: error.status || null
    });
    return response.status(500).json({
      success: false,
      error: error.code || "internal_error"
    });
  }
};
