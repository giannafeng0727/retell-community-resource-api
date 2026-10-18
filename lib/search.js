const { resources } = require("./resources");

const allowedTypes = new Set(["shelter", "food", "water", "transportation"]);

function distanceMiles(aLat, aLon, bLat, bLon) {
  const radius = 3958.8;
  const toRadians = (value) => (value * Math.PI) / 180;
  const p1 = toRadians(aLat);
  const p2 = toRadians(bLat);
  const dp = toRadians(bLat - aLat);
  const dl = toRadians(bLon - aLon);
  const value =
    Math.sin(dp / 2) ** 2 +
    Math.cos(p1) * Math.cos(p2) * Math.sin(dl / 2) ** 2;
  return radius * 2 * Math.atan2(Math.sqrt(value), Math.sqrt(1 - value));
}

function validateRequest(input) {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    return "invalid_json_body";
  }
  if (!allowedTypes.has(input.resource_type)) {
    return "invalid_resource_type";
  }
  if (typeof input.location !== "string" || !input.location.trim()) {
    return "location_required";
  }
  if (input.people_count !== undefined && (!Number.isInteger(input.people_count) || input.people_count < 1)) {
    return "invalid_people_count";
  }
  if (input.children_count !== undefined && (!Number.isInteger(input.children_count) || input.children_count < 0)) {
    return "invalid_children_count";
  }
  return null;
}

function matches(resource, input) {
  if (!resource.types.includes(input.resource_type) || resource.status === "closed") return false;
  if ((input.children_count || 0) > 0 && !resource.accepts_children) return false;
  if (input.accessibility_required && !resource.wheelchair_accessible) return false;
  if (input.medical_power_required && !resource.medical_power_available) return false;
  if (input.has_pet && !resource.accepts_pets) return false;
  if (input.has_service_animal && !resource.accepts_service_animals) return false;
  if (
    input.people_count &&
    resource.capacity_remaining !== null &&
    resource.capacity_remaining < input.people_count
  ) return false;
  return true;
}

function searchResources(input) {
  const maxDistance = input.max_distance_miles || 10;
  const hasCoordinates =
    input.coordinates &&
    Number.isFinite(input.coordinates.latitude) &&
    Number.isFinite(input.coordinates.longitude);

  const results = resources
    .filter((resource) => matches(resource, input))
    .map((resource) => {
      const { latitude, longitude, ...publicResource } = resource;
      const distance = hasCoordinates
        ? Number(
            distanceMiles(
              input.coordinates.latitude,
              input.coordinates.longitude,
              latitude,
              longitude
            ).toFixed(1)
          )
        : null;
      return { ...publicResource, distance_miles: distance };
    })
    .filter((resource) => resource.distance_miles === null || resource.distance_miles <= maxDistance);

  const availabilityRank = {
    simulation_confirmed: 0,
    provider_confirmed: 0,
    recent_unconfirmed: 1,
    unknown: 2
  };

  results.sort((a, b) => {
    const statusDifference =
      (availabilityRank[a.availability_status] ?? 3) -
      (availabilityRank[b.availability_status] ?? 3);
    if (statusDifference !== 0) return statusDifference;
    return (a.distance_miles ?? 9999) - (b.distance_miles ?? 9999);
  });

  const topResults = results.slice(0, 3);
  return {
    success: true,
    result_count: topResults.length,
    search_summary: topResults.length
      ? `Found ${topResults.length} possible resource option(s).`
      : "No suitable resource was found for the confirmed constraints.",
    results: topResults,
    fallback_required: topResults.length === 0,
    fallback_reason: topResults.length === 0 ? "no_matching_resources" : null
  };
}

module.exports = { searchResources, validateRequest };
