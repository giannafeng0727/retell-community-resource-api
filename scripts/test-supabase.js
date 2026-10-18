const assert = require("node:assert/strict");
const {
  insertAssistanceRequest,
  listAssistanceRequests,
  listReunificationCases
} = require("../lib/supabase");
const listAssistanceHandler = require("../api/assistance-requests/list");

process.env.SUPABASE_URL = "https://example.supabase.co";
process.env.SUPABASE_SECRET_KEY = "sb_secret_test_value";

let capturedRequest;
global.fetch = async (url, options) => {
  capturedRequest = { url, options };
  return {
    ok: true,
    async json() {
      return [
        {
          id: "request-id",
          reference_code: "REQ-TEST",
          status: "queued",
          priority: "normal",
          priority_score: 0,
          priority_reasons: [],
          created_at: "2026-10-17T00:00:00Z"
        }
      ];
    }
  };
};

(async () => {
  await insertAssistanceRequest({ status: "queued", source_call_id: "test-call-1" });

  assert.equal(capturedRequest.options.headers.apikey, "sb_secret_test_value");
  assert.equal("Authorization" in capturedRequest.options.headers, false);
  assert.equal(
    capturedRequest.options.headers.Prefer,
    "resolution=merge-duplicates,return=representation"
  );
  assert.equal(capturedRequest.url.includes("on_conflict=source_call_id"), true);

  const rows = await listAssistanceRequests(999);
  assert.equal(rows.length, 1);
  assert.equal(capturedRequest.options.method, "GET");
  assert.equal(capturedRequest.options.headers.apikey, "sb_secret_test_value");
  assert.equal("Authorization" in capturedRequest.options.headers, false);
  assert.equal(capturedRequest.url.includes("order=created_at.desc"), true);
  assert.equal(capturedRequest.url.includes("limit=200"), true);

  await listReunificationCases(5);
  assert.equal(capturedRequest.options.method, "GET");
  assert.equal(capturedRequest.url.includes("/rest/v1/reunification_cases?"), true);
  assert.equal(capturedRequest.url.includes("limit=5"), true);

  const headers = {};
  let responseBody;
  const response = {
    setHeader(name, value) { headers[name] = value; },
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(body) {
      responseBody = body;
      return this;
    }
  };
  await listAssistanceHandler({ method: "GET", query: { limit: "5" } }, response);
  assert.equal(response.statusCode, 200);
  assert.equal(headers["Cache-Control"], "no-store, max-age=0");
  assert.equal(responseBody.success, true);
  assert.equal(responseBody.requests[0].reference_code, "REQ-TEST");

  console.log("Supabase request header tests passed.");
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
