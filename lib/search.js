const { resources } = require("./resources");

const allowedTypes = new Set(["shelter", "food", "water", "transportation"]);

// Retell often has a spoken landmark or street but no latitude/longitude.
// Keep this deliberately small and local to the Malibu demo rather than
// pretending to be a general-purpose geocoder.
const malibuLocationAnchors = [
  { terms: ["malibu creek", "state park"], latitude: 34.1015, longitude: -118.7275 },
  { terms: ["point dume", "birdview", "wildlife road", "wildlife rd"], latitude: 34.0110, longitude: -118.8010 },
  { terms: ["zuma", "morning view", "malibu high"], latitude: 34.0250, longitude: -118.8350 },
  { terms: ["latigo"], latitude: 34.0668, longitude: -118.7628 },
  { terms: ["corral canyon", "solstice canyon"], latitude: 34.0550, longitude: -118.7400 },
  { terms: ["paradise cove"], latitude: 34.0222, longitude: -118.7868 },
  { terms: ["pepperdine", "seaver"], latitude: 34.0418, longitude: -118.7095 },
  { terms: ["civic center", "city hall", "malibu library"], latitude: 34.0366, longitude: -118.6874 },
  { terms: ["malibu pier"], latitude: 34.0356, longitude: -118.6762 },
  { terms: ["90265", "malibu"], latitude: 34.0350, longitude: -118.7500 }
];

function inferMalibuCoordinates(location) {
  if (typeof location !== "string") return null;
  const normalized = location.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
  if (!normalized) return null;
  const anchor = malibuLocationAnchors.find(item => item.terms.some(term => normalized.includes(term)));
  return anchor ? { latitude: anchor.latitude, longitude: anchor.longitude } : null;
}

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
  const providedCoordinates =
    input.coordinates &&
    Number.isFinite(input.coordinates.latitude) &&
    Number.isFinite(input.coordinates.longitude);
  const coordinates = providedCoordinates ? input.coordinates : inferMalibuCoordinates(input.location);
  const hasCoordinates = !!coordinates;

  const results = resources
    .filter((resource) => matches(resource, input))
    .map((resource) => {
      const { latitude, longitude, ...publicResource } = resource;
      const distance = hasCoordinates
        ? Number(
            distanceMiles(
              coordinates.latitude,
              coordinates.longitude,
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
    location_resolution: providedCoordinates ? "provided_coordinates" : hasCoordinates ? "malibu_landmark" : "unresolved",
    search_summary: topResults.length
      ? `Found ${topResults.length} possible resource option(s).`
      : "No suitable resource was found for the confirmed constraints.",
    results: topResults,
    fallback_required: topResults.length === 0,
    fallback_reason: topResults.length === 0 ? "no_matching_resources" : null
  };
}

module.exports = { inferMalibuCoordinates, searchResources, validateRequest };
