import hl7Dictionary from "hl7-dictionary";

const definitions = hl7Dictionary?.definitions || {};

export const SUPPORTED_HL7_VERSIONS = Object.keys(definitions).sort((a, b) =>
  a.localeCompare(b, undefined, { numeric: true, sensitivity: "base" })
);

function getDictionaryForVersion(version) {
  if (version && definitions[version]) return definitions[version];

  const fallback =
    (SUPPORTED_HL7_VERSIONS.includes("2.3") && "2.3") || SUPPORTED_HL7_VERSIONS[0] || "";
  return fallback ? definitions[fallback] : null;
}

function buildMshDefaults(version) {
  return {
    1: "|",
    2: "^~\\&",
    3: "NODEAPP",
    4: "HOSP",
    5: "HL7SYS",
    6: "HOSP",
    7: "", // computed at runtime
    9: "ADT^A01",
    10: "", // computed at runtime
    11: "P",
    12: version || "2.3"
  };
}

function isRequiredField(fieldDef) {
  // In hl7-dictionary, `opt` is 2 for required, 1 for optional.
  return fieldDef?.opt === 2;
}

export function getHl7SchemasForVersion(version) {
  const dict = getDictionaryForVersion(version);
  if (!dict?.segments) return {};

  const schemas = {};
  for (const [segmentId, segmentDef] of Object.entries(dict.segments)) {
    const fields = Array.isArray(segmentDef?.fields) ? segmentDef.fields : [];
    const labels = {};
    const requiredFields = [];

    for (let idx = 0; idx < fields.length; idx++) {
      const fieldNumber = idx + 1;
      labels[fieldNumber] = fields[idx]?.desc || `Field ${fieldNumber}`;
      if (isRequiredField(fields[idx])) requiredFields.push(fieldNumber);
    }

    schemas[segmentId] = {
      description: segmentDef?.desc || "",
      maxField: fields.length,
      requiredFields,
      labels,
      defaults: {}
    };
  }

  // Provide app-friendly defaults for MSH if present in the dictionary.
  if (schemas.MSH) {
    schemas.MSH.defaults = buildMshDefaults(version);
  }

  return schemas;
}
