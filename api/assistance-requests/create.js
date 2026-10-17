const {
  buildDatabaseRecord,
  validateAssistanceRequest
} = require("../../lib/assistance");
const { insertAssistanceRequest } = require("../../lib/supabase");

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

  const validationError = validateAssistanceRequest(request.body);
  if (validationError) {
    const status = validationError === "emergency_escalation_required" ? 409 : 400;
    return response.status(status).json({ success: false, error: validationError });
  }

  try {
    const saved = await insertAssistanceRequest(buildDatabaseRecord(request.body));
    return response.status(201).json({
      success: true,
      request_id: saved.id,
      reference_code: saved.reference_code,
      status: saved.status,
      priority: saved.priority,
      priority_score: saved.priority_score,
      priority_reasons: saved.priority_reasons,
      created_at: saved.created_at
    });
  } catch (error) {
    console.error("Unable to create assistance request", {
      code: error.code || "unknown_error",
      status: error.status || null
    });
    return response.status(500).json({
      success: false,
      error: error.code || "internal_error"
    });
  }
};
