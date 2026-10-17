const { resources } = require("../lib/resources");

module.exports = function handler(request, response) {
  if (request.method !== "GET") {
    response.setHeader("Allow", "GET");
    return response.status(405).json({ ok: false, error: "method_not_allowed" });
  }
  return response.status(200).json({ ok: true, resource_count: resources.length });
};
