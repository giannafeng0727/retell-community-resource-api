const { searchResources, validateRequest } = require("../../lib/search");

module.exports = function handler(request, response) {
  if (request.method !== "POST") {
    response.setHeader("Allow", "POST");
    return response.status(405).json({ success: false, error: "method_not_allowed" });
  }

  const configuredKey = process.env.RESOURCE_API_KEY;
  if (configuredKey) {
    const suppliedKey = request.headers.authorization;
    if (suppliedKey !== `Bearer ${configuredKey}`) {
      return response.status(401).json({ success: false, error: "unauthorized" });
    }
  }

  const error = validateRequest(request.body);
  if (error) {
    return response.status(400).json({ success: false, error });
  }

  return response.status(200).json(searchResources(request.body));
};
