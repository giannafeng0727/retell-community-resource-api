const { updateReunificationCase } = require("../../lib/supabase");

const allowedStatuses = new Set(["queued", "in_progress", "matched", "resolved"]);

module.exports = async function handler(request, response) {
  if (request.method !== "POST") {
    response.setHeader("Allow", "POST");
    return response.status(405).json({ success: false, error: "method_not_allowed" });
  }

  const id = typeof request.body?.id === "string" ? request.body.id.trim() : "";
  const status = typeof request.body?.status === "string" ? request.body.status.trim() : "";
  if (!id) return response.status(400).json({ success: false, error: "case_id_required" });
  if (!allowedStatuses.has(status)) return response.status(400).json({ success: false, error: "invalid_status" });

  try {
    const updated = await updateReunificationCase(id, { status });
    return response.status(200).json({
      success: true,
      case: {
        id: updated.id,
        reference_code: updated.reference_code,
        status: updated.status,
        updated_at: updated.updated_at
      }
    });
  } catch (error) {
    console.error("Unable to update reunification case", { code: error.code || "unknown_error", status: error.status || null });
    return response.status(500).json({ success: false, error: error.code || "internal_error" });
  }
};
