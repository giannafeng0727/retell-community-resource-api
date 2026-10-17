const assert = require("node:assert/strict");
const { insertAssistanceRequest } = require("../lib/supabase");

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

  console.log("Supabase request header tests passed.");
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
