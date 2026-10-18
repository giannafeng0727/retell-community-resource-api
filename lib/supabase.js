function requireEnvironment(name) {
  const value = process.env[name];
  if (!value) {
    const error = new Error(`Missing required environment variable: ${name}`);
    error.code = "server_not_configured";
    throw error;
  }
  return value;
}

async function writeRecord(table, fields, record) {
  const supabaseUrl = requireEnvironment("SUPABASE_URL").replace(/\/$/, "");
  const secretKey = requireEnvironment("SUPABASE_SECRET_KEY");
  const query = new URLSearchParams({ select: fields.join(",") });
  let prefer = "return=representation";

  if (record.source_call_id) {
    query.set("on_conflict", "source_call_id");
    prefer = "resolution=merge-duplicates,return=representation";
  }

  const response = await fetch(`${supabaseUrl}/rest/v1/${table}?${query}`, {
    method: "POST",
    headers: {
      apikey: secretKey,
      "Content-Type": "application/json",
      Prefer: prefer
    },
    body: JSON.stringify(record)
  });

  if (!response.ok) {
    const error = new Error("Supabase write failed");
    error.code = "database_write_failed";
    error.status = response.status;
    throw error;
  }

  const rows = await response.json();
  if (!Array.isArray(rows) || !rows[0]) {
    const error = new Error("Supabase returned no saved row");
    error.code = "database_write_failed";
    throw error;
  }

  return rows[0];
}

async function insertAssistanceRequest(record) {
  return writeRecord("assistance_requests", [
    "id",
    "reference_code",
    "status",
    "priority",
    "priority_score",
    "priority_reasons",
    "created_at"
  ], record);
}

async function insertReunificationCase(record) {
  return writeRecord("reunification_cases", [
    "id",
    "reference_code",
    "case_type",
    "status",
    "created_at"
  ], record);
}

async function listAssistanceRequests(limit = 100) {
  const supabaseUrl = requireEnvironment("SUPABASE_URL").replace(/\/$/, "");
  const secretKey = requireEnvironment("SUPABASE_SECRET_KEY");
  const safeLimit = Math.max(1, Math.min(Number.parseInt(limit, 10) || 100, 200));
  const query = new URLSearchParams({
    select: "*",
    order: "created_at.desc",
    limit: String(safeLimit)
  });

  const response = await fetch(`${supabaseUrl}/rest/v1/assistance_requests?${query}`, {
    method: "GET",
    headers: { apikey: secretKey }
  });

  if (!response.ok) {
    const error = new Error("Supabase read failed");
    error.code = "database_read_failed";
    error.status = response.status;
    throw error;
  }

  const rows = await response.json();
  if (!Array.isArray(rows)) {
    const error = new Error("Supabase returned an invalid response");
    error.code = "database_read_failed";
    throw error;
  }

  return rows;
}

async function listReunificationCases(limit = 100) {
  const supabaseUrl = requireEnvironment("SUPABASE_URL").replace(/\/$/, "");
  const secretKey = requireEnvironment("SUPABASE_SECRET_KEY");
  const safeLimit = Math.max(1, Math.min(Number.parseInt(limit, 10) || 100, 200));
  const query = new URLSearchParams({
    select: "*",
    order: "created_at.desc",
    limit: String(safeLimit)
  });

  const response = await fetch(`${supabaseUrl}/rest/v1/reunification_cases?${query}`, {
    method: "GET",
    headers: { apikey: secretKey }
  });

  if (!response.ok) {
    const error = new Error("Supabase read failed");
    error.code = "database_read_failed";
    error.status = response.status;
    throw error;
  }

  const rows = await response.json();
  if (!Array.isArray(rows)) {
    const error = new Error("Supabase returned an invalid response");
    error.code = "database_read_failed";
    throw error;
  }

  return rows;
}

module.exports = {
  insertAssistanceRequest,
  insertReunificationCase,
  listAssistanceRequests,
  listReunificationCases
};
