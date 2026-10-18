const { listAssistanceRequests } = require("../../lib/supabase");

function publicRecord(row) {
  const metadata = row.metadata && typeof row.metadata === "object" ? row.metadata : {};
  return {
    id: row.id,
    reference_code: row.reference_code,
    status: row.status,
    priority: row.priority,
    priority_score: row.priority_score,
    priority_reasons: row.priority_reasons,
    resource_type: row.resource_type,
    caller_location: row.caller_location_approx,
    location_confidence: row.location_confidence,
    people_count: row.people_count,
    children_count: row.children_count,
    accessibility_required: row.accessibility_required,
    medical_power_required: row.medical_power_required,
    has_pet: row.has_pet,
    has_service_animal: row.has_service_animal,
    needs_transportation: row.needs_transportation,
    preferred_language: row.preferred_language,
    callback_number: row.callback_number,
    search_failure_reason: row.search_failure_reason,
    source_call_id: row.source_call_id,
    created_at: row.created_at,
    updated_at: row.updated_at,
    caller_name: metadata.caller_name || null,
    conversation_summary: metadata.conversation_summary || null,
    latitude: Number.isFinite(metadata.latitude) ? metadata.latitude : null,
    longitude: Number.isFinite(metadata.longitude) ? metadata.longitude : null
  };
}

module.exports = async function handler(request, response) {
  if (request.method !== "GET") {
    response.setHeader("Allow", "GET");
    return response.status(405).json({ success: false, error: "method_not_allowed" });
  }

  response.setHeader("Cache-Control", "no-store, max-age=0");

  try {
    const rows = await listAssistanceRequests(request.query?.limit);
    return response.status(200).json({
      success: true,
      requests: rows.map(publicRecord),
      fetched_at: new Date().toISOString()
    });
  } catch (error) {
    console.error("Unable to list assistance requests", {
      code: error.code || "unknown_error",
      status: error.status || null
    });
    return response.status(500).json({
      success: false,
      error: error.code || "internal_error"
    });
  }
};
