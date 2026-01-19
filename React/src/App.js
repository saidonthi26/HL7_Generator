import { useEffect, useMemo, useState } from "react";
import "./App.css";

import { getHl7SchemasForVersion, SUPPORTED_HL7_VERSIONS } from "./hl7/schema";

const MANDATORY_SEGMENTS = ["PID", "PV1"];

function formatHL7Timestamp(date) {
  const yyyy = String(date.getFullYear());
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const dd = String(date.getDate()).padStart(2, "0");
  const hh = String(date.getHours()).padStart(2, "0");
  const mi = String(date.getMinutes()).padStart(2, "0");
  const ss = String(date.getSeconds()).padStart(2, "0");
  return `${yyyy}${mm}${dd}${hh}${mi}${ss}`;
}

function buildMSH({ mappings, jsonData, hl7Version, schema }) {
  const timestamp = formatHL7Timestamp(new Date());
  const messageId =
    typeof crypto !== "undefined" && crypto.randomUUID
      ? crypto.randomUUID()
      : String(Math.random()).slice(2);

  const maxField = schema?.maxField || 21;
  const fields = new Array(maxField + 1).fill("");
  for (const [fieldIndexText, defaultValue] of Object.entries(schema?.defaults || {})) {
    fields[Number(fieldIndexText)] = defaultValue;
  }
  fields[7] = timestamp;
  fields[10] = messageId;
  if (hl7Version) fields[12] = hl7Version;

  if (Array.isArray(mappings) && jsonData) {
    for (const mapping of mappings) {
      if (mapping.segment !== "MSH") continue;
      const value = getObjectAtPath(jsonData, mapping.sourcePath);
      fields[mapping.field] = stringifyValue(value);
    }
  }

  let segment = "MSH";
  // MSH-1 is field separator, special: it becomes the 4th char in segment
  segment += fields[1] || "|";
  // MSH-2 is encoding characters, then continue with MSH-3..max
  segment += `${fields[2] || "^~\\&"}`;
  for (let i = 3; i <= maxField; i++) {
    segment += `${fields[1] || "|"}${fields[i] || ""}`;
  }
  return segment;
}

function parseJsonSafely(text) {
  try {
    return { value: JSON.parse(text), error: "" };
  } catch (e) {
    return { value: null, error: e?.message || "Invalid JSON" };
  }
}

function isPlainObject(value) {
  return (
    value !== null &&
    typeof value === "object" &&
    !Array.isArray(value) &&
    Object.prototype.toString.call(value) === "[object Object]"
  );
}

function tokenizePath(path) {
  if (!path || path === "$") return [];

  const withoutRoot = path.startsWith("$.") ? path.slice(2) : path.slice(1);
  const tokens = [];
  let current = "";

  for (let i = 0; i < withoutRoot.length; i++) {
    const ch = withoutRoot[i];

    if (ch === ".") {
      if (current) tokens.push(current);
      current = "";
      continue;
    }

    if (ch === "[") {
      if (current) tokens.push(current);
      current = "";
      const closing = withoutRoot.indexOf("]", i);
      if (closing === -1) break;
      const indexText = withoutRoot.slice(i + 1, closing);
      tokens.push({ index: Number(indexText) });
      i = closing;
      continue;
    }

    current += ch;
  }

  if (current) tokens.push(current);
  return tokens;
}

function getObjectAtPath(root, objectPath) {
  const tokens = tokenizePath(objectPath);
  let current = root;

  for (const token of tokens) {
    if (current === null || current === undefined) return undefined;

    if (typeof token === "string") {
      if (!isPlainObject(current)) return undefined;

      if (Object.prototype.hasOwnProperty.call(current, token)) {
        current = current[token];
        continue;
      }

      const lower = token.toLowerCase();
      const matchingKey = Object.keys(current).find((k) => k.toLowerCase() === lower);
      current = matchingKey ? current[matchingKey] : undefined;
      continue;
    }

    if (typeof token === "object" && token && "index" in token) {
      if (!Array.isArray(current)) return undefined;
      current = current[token.index];
    }
  }

  return current;
}

function stringifyValue(value) {
  if (value === null || value === undefined) return "";
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  return JSON.stringify(value);
}

function normalizeJsonPath(path) {
  if (!path) return "";
  const trimmed = String(path).trim();
  if (!trimmed) return "";

  const unquoted = trimmed.replace(/^['"]+|['"]+$/g, "");
  if (!unquoted) return "";

  if (unquoted === "$") return "$";
  if (unquoted.startsWith("$")) return unquoted;
  if (unquoted.startsWith(".")) return `$${unquoted}`;
  return `$.${unquoted}`;
}

function findJsonPathsForKey(root, keyName, { maxMatches = 25 } = {}) {
  const matches = [];
  const visited = new Set();

  const push = (path) => {
    matches.push(path);
  };

  const walk = (value, path) => {
    if (matches.length >= maxMatches) return;
    if (value === null || value === undefined) return;

    if (typeof value === "object") {
      if (visited.has(value)) return;
      visited.add(value);
    }

    if (Array.isArray(value)) {
      for (let i = 0; i < value.length; i++) {
        walk(value[i], `${path}[${i}]`);
        if (matches.length >= maxMatches) return;
      }
      return;
    }

    if (isPlainObject(value)) {
      for (const [k, v] of Object.entries(value)) {
        const nextPath = `${path}.${k}`;
        if (k === keyName) push(nextPath);
        walk(v, nextPath);
        if (matches.length >= maxMatches) return;
      }
    }
  };

  walk(root, "$");
  return matches;
}

function coerceDroppedPathWithJson({ droppedText, selectedObjectBasePath, jsonData }) {
  const trimmed = String(droppedText || "").trim();
  if (!trimmed) return { path: "", error: "" };

  const unquoted = trimmed.replace(/^['"]+|['"]+$/g, "");
  if (!unquoted) return { path: "", error: "" };

  const base = String(selectedObjectBasePath || "").trim();
  const canScopeToSelectedObject = Boolean(base) && base !== "$";

  // Handle user dragging a bare key like `id`, `"id"`, `.id`, or `$.id` (from text selection)
  // by scoping it to the currently selected object, if any.
  const keyMatch = unquoted.match(/^(?:\$\.)?\.?([A-Za-z0-9_]+)$/);
  if (keyMatch && canScopeToSelectedObject) {
    return { path: normalizeJsonPath(`${base}.${keyMatch[1]}`), error: "" };
  }

  // If it's a bare key and no object is selected, infer a unique path from the parsed JSON.
  if (keyMatch && jsonData) {
    const keyName = keyMatch[1];
    const found = findJsonPathsForKey(jsonData, keyName);
    if (found.length === 1) return { path: normalizeJsonPath(found[0]), error: "" };
    if (found.length > 1) {
      return {
        path: "",
        error: `Multiple matches for "${keyName}". Select the object on the left, then drag again.`
      };
    }
  }

  return { path: normalizeJsonPath(unquoted), error: "" };
}

function buildSegmentWithMappings(segmentId, schema, mappings, jsonData) {
  const fields = new Array(schema.maxField + 1).fill("");

  for (const [fieldIndexText, defaultValue] of Object.entries(schema.defaults)) {
    fields[Number(fieldIndexText)] = defaultValue;
  }

  for (const mapping of mappings) {
    if (mapping.segment !== segmentId) continue;
    const value = getObjectAtPath(jsonData, mapping.sourcePath);
    fields[mapping.field] = stringifyValue(value);
  }

  // MSH needs special handling; it's built separately.
  let segment = segmentId;
  for (let i = 1; i <= schema.maxField; i++) {
    segment += `|${fields[i] || ""}`;
  }
  return segment;
}

function App() {
  const [jsonInput, setJsonInput] = useState(`{
  "patient": {
    "id": "P1001",
    "name": { "first": "Ravi", "last": "Kumar" },
    "age": 30,
    "sex": "M",
    "phone": "9999999999",
    "address": { "line1": "12 Main St", "city": "Hyderabad", "state": "TS" }
  },
  "visit": {
    "class": "O",
    "location": { "pointOfCare": "OPD", "room": "12" },
    "attendingDoctor": { "id": "D101", "name": "Dr. Smith" }
  },
  "nextOfKin": [
    { "name": "Anita Kumar", "relationship": "SPO", "phone": "8888888888" }
  ],
  "allergies": [
    { "type": "DA", "code": "PEN", "description": "Penicillin", "severity": "SV" }
  ],
  "observations": [
    { "valueType": "NM", "id": "GLU", "value": 105, "units": "mg/dL", "status": "F" }
  ]
}`);

  const [hl7Output, setHl7Output] = useState("");
  const [error, setError] = useState("");
  const [hl7Version, setHl7Version] = useState("2.3");
  const [copied, setCopied] = useState(false);

  const [targetSegment, setTargetSegment] = useState("PID");
  const [mappings, setMappings] = useState([]);
  const [segmentSearch, setSegmentSearch] = useState("");
  const [jsonSearch, setJsonSearch] = useState("");
  const [selectedObjectName, setSelectedObjectName] = useState("");
  const [selectedKeyPath, setSelectedKeyPath] = useState("");
  const [theme, setTheme] = useState(() => {
    try {
      return localStorage.getItem("hl7-ui-theme") || "light";
    } catch {
      return "light";
    }
  });

  const parsed = parseJsonSafely(jsonInput);
  const jsonData = parsed.value;
  const jsonParseError = parsed.error;

  const HL7_SCHEMAS = useMemo(() => getHl7SchemasForVersion(hl7Version), [hl7Version]);

  const segmentIds = useMemo(() => {
    const ids = Object.keys(HL7_SCHEMAS);
    ids.sort((a, b) => a.localeCompare(b));
    if (ids.includes("MSH")) {
      ids.splice(ids.indexOf("MSH"), 1);
      ids.unshift("MSH");
    }
    return ids;
  }, [HL7_SCHEMAS]);

  const filteredSegmentIds = useMemo(() => {
    const term = segmentSearch.trim().toLowerCase();
    if (!term) return segmentIds;
    return segmentIds.filter((id) => id.toLowerCase().includes(term));
  }, [segmentIds, segmentSearch]);

  useEffect(() => {
    setSelectedObjectName("");
    setSelectedKeyPath("");
  }, [jsonInput]);

  useEffect(() => {
    try {
      localStorage.setItem("hl7-ui-theme", theme);
      document.documentElement.dataset.theme = theme;
    } catch {
      // ignore
    }
  }, [theme]);

  useEffect(() => {
    if (!HL7_SCHEMAS[targetSegment]) {
      setTargetSegment(HL7_SCHEMAS.PID ? "PID" : segmentIds[0] || "MSH");
    }
  }, [HL7_SCHEMAS, segmentIds, targetSegment]);

  const addOrReplaceMapping = ({ segment, field, sourcePath }) => {
    setMappings((prev) => {
      const next = prev.filter((m) => !(m.segment === segment && m.field === field));
      next.push({ segment, field, sourcePath: normalizeJsonPath(sourcePath) });
      next.sort((a, b) => {
        if (a.segment !== b.segment) return a.segment.localeCompare(b.segment);
        return a.field - b.field;
      });
      return next;
    });
  };

  const removeMapping = (segment, field) => {
    setMappings((prev) => prev.filter((m) => !(m.segment === segment && m.field === field)));
  };

  const getFieldLabel = (segment, field) => {
    const label = HL7_SCHEMAS[segment]?.labels?.[field];
    return label || `Field ${field}`;
  };

  const isMandatoryField = (segmentId, fieldNumber) =>
    HL7_SCHEMAS[segmentId]?.requiredFields?.includes(fieldNumber);

  const getMappedPathForField = (segmentId, fieldNumber) =>
    mappings.find((m) => m.segment === segmentId && m.field === fieldNumber)?.sourcePath || "";

  const isSourcePathMapped = (sourcePath) =>
    Boolean(sourcePath) &&
    mappings.some((m) => normalizeJsonPath(m.sourcePath) === normalizeJsonPath(sourcePath));

  const mapSelectedKeyToField = (segment, field) => {
    setError("");
    setHl7Output("");

    if (!jsonData || jsonParseError) {
      setError(jsonParseError || "Enter valid JSON before mapping");
      return;
    }

    if (!selectedKeyPath) {
      setError("Select a JSON key first");
      return;
    }

    addOrReplaceMapping({ segment, field, sourcePath: selectedKeyPath });
  };

  const getMappedOrDefaultValue = (segmentId, fieldNumber) => {
    const mapping = mappings.find((m) => m.segment === segmentId && m.field === fieldNumber);
    if (mapping) return stringifyValue(getObjectAtPath(jsonData, mapping.sourcePath));

    if (segmentId === "MSH" && fieldNumber === 7) {
      return formatHL7Timestamp(new Date());
    }
    if (segmentId === "MSH" && fieldNumber === 10) {
      return (
        (typeof crypto !== "undefined" && crypto.randomUUID && crypto.randomUUID()) ||
        `MSG${String(Math.random()).slice(2)}`
      );
    }
    if (segmentId === "MSH" && fieldNumber === 12) {
      return hl7Version;
    }

    const defaultValue = HL7_SCHEMAS[segmentId]?.defaults?.[fieldNumber];
    if (defaultValue === undefined) return "";
    return String(defaultValue);
  };

  const topLevelObjectNames = isPlainObject(jsonData) ? Object.keys(jsonData) : [];
  const selectedObjectValue =
    jsonData && selectedObjectName ? getObjectAtPath(jsonData, `$.${selectedObjectName}`) : null;
  const selectedObjectBasePath = (() => {
    if (!selectedObjectName) return "";
    if (Array.isArray(selectedObjectValue)) return `$.${selectedObjectName}[0]`;
    return `$.${selectedObjectName}`;
  })();
  const selectedObjectKeys = (() => {
    if (!selectedObjectName) return [];
    if (isPlainObject(selectedObjectValue)) return Object.keys(selectedObjectValue);
    if (Array.isArray(selectedObjectValue)) {
      const first = selectedObjectValue[0];
      if (isPlainObject(first)) return Object.keys(first);
    }
    return [];
  })();
  const filteredObjectKeys = selectedObjectKeys
    .filter((k) => k.toLowerCase().includes(jsonSearch.trim().toLowerCase()))
    .slice(0, 200);

  const generateHL7FromMappings = () => {
    setError("");
    setHl7Output("");

    if (!jsonData) {
      setError("Enter valid JSON before generating HL7");
      return;
    }

    if (jsonParseError) {
      setError(jsonParseError);
      return;
    }

    const isIncluded = (segmentId) => {
      if (segmentId === "MSH") return true;
      if (MANDATORY_SEGMENTS.includes(segmentId) && HL7_SCHEMAS[segmentId]) return true;
      return mappings.some((m) => m.segment === segmentId);
    };

    for (const [segmentId, schema] of Object.entries(HL7_SCHEMAS)) {
      if (!isIncluded(segmentId)) continue;
      for (const field of schema.requiredFields) {
        const value = getMappedOrDefaultValue(segmentId, field);
        if (!value) {
          setError(`${segmentId}-${field} is required; provide a value (mapping or default)`);
          return;
        }
      }
    }

    const included = new Set();
    included.add("MSH");

    for (const seg of MANDATORY_SEGMENTS) {
      if (HL7_SCHEMAS[seg]) included.add(seg);
    }

    for (const mapping of mappings) {
      if (HL7_SCHEMAS[mapping.segment]) included.add(mapping.segment);
    }

    const ordered = Array.from(included);
    ordered.sort((a, b) => {
      if (a === "MSH") return -1;
      if (b === "MSH") return 1;
      const aMandatory = MANDATORY_SEGMENTS.includes(a);
      const bMandatory = MANDATORY_SEGMENTS.includes(b);
      if (aMandatory !== bMandatory) return aMandatory ? -1 : 1;
      return a.localeCompare(b);
    });

    const segments = ordered.map((segmentId) => {
      if (segmentId === "MSH") {
        return buildMSH({ mappings, jsonData, hl7Version, schema: HL7_SCHEMAS.MSH });
      }
      return buildSegmentWithMappings(segmentId, HL7_SCHEMAS[segmentId], mappings, jsonData);
    });

    setHl7Output(segments.join("\n"));
  };

  const copyHl7ToClipboard = async () => {
    if (!hl7Output) return;
    try {
      await navigator.clipboard.writeText(hl7Output);
      setCopied(true);
      setTimeout(() => setCopied(false), 1200);
    } catch {
      setError("Copy failed. Please copy manually from the HL7 output box.");
    }
  };

  return (
    <div className="app-container" data-theme={theme}>
      <div className="card">
        <div className="header-row">
          <div className="header-titles">
            <h1 className="title">HL7 Generator</h1>
            <p className="subtitle">Map JSON keys to HL7 fields and generate HL7 v2</p>
          </div>
          <div className="header-actions">
            <button
              type="button"
              className="mini ghost"
              onClick={() => setTheme((t) => (t === "dark" ? "light" : "dark"))}
              aria-label={theme === "dark" ? "Switch to light theme" : "Switch to dark theme"}
              title={theme === "dark" ? "Switch to light theme" : "Switch to dark theme"}
            >
              {theme === "dark" ? "Light" : "Dark"}
            </button>
          </div>
        </div>

        <div className="workspace">
          <div className="panel json-panel">
            <div className="panel-title">JSON Input</div>
            <textarea
              className="textarea editor"
              value={jsonInput}
              onChange={(e) => setJsonInput(e.target.value)}
            />
            {jsonParseError && <div className="hint">JSON error: {jsonParseError}</div>}

            <input
              className="input search"
              value={jsonSearch}
              onChange={(e) => setJsonSearch(e.target.value)}
              placeholder="Filter keys (e.g. id, phone, address)"
            />

            <div className="sub-title">JSON Fields (Drag to HL7)</div>
            <div className="picker">
              <div>
                <label className="label small" htmlFor="json-object">
                  Object (top-level)
                </label>
                <select
                  id="json-object"
                  className="select"
                  value={selectedObjectName}
                  onChange={(e) => {
                    setSelectedObjectName(e.target.value);
                  }}
                  disabled={!topLevelObjectNames.length}
                >
                  <option value="">Select object...</option>
                  {topLevelObjectNames.map((name) => (
                    <option key={name} value={name}>
                      {name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {selectedObjectName ? (
              selectedObjectKeys.length ? (
                <div className="keys">
                  <div className="keys-title">
                    Keys in <span className="mono">{selectedObjectBasePath}</span>
                  </div>
                  <div className="keys-grid" role="list" aria-label="Object keys">
                    {filteredObjectKeys.map((k) => {
                      const path = `${selectedObjectBasePath}.${k}`;
                      const valuePreview = stringifyValue(getObjectAtPath(jsonData, path));
                      const mapped = isSourcePathMapped(path);
                      const selected = selectedKeyPath === path;
                      return (
                        <div
                          key={path}
                          className={
                            ["key-item", mapped ? "mapped" : "", selected ? "selected" : ""]
                              .filter(Boolean)
                              .join(" ")
                          }
                          role="listitem"
                          draggable
                          onDragStart={(e) => {
                            e.dataTransfer.setData("text/plain", path);
                            e.dataTransfer.setData("application/x-hl7-jsonpath", path);
                            e.dataTransfer.effectAllowed = "copy";
                          }}
                          onClick={() => setSelectedKeyPath(path)}
                          title="Drag this key onto an HL7 field"
                        >
                          <div className="key-header">
                            <div className="mono">{k}</div>
                            <button
                              className="mini"
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setSelectedKeyPath(path);
                              }}
                            >
                              {selected ? "Selected" : "Select"}
                            </button>
                          </div>
                          <div className="json-value mono">{valuePreview || "-"}</div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ) : (
                <div className="hint">No keys available for this selection.</div>
              )
            ) : null}

            <div className="mapping-table">
              <div className="mapping-title">All Mappings</div>
              {mappings.length === 0 ? (
                <div className="hint">No mappings yet.</div>
              ) : (
                <div className="table-scroll">
                  <table className="table">
                    <thead>
                      <tr>
                        <th>HL7 Field</th>
                        <th>*</th>
                        <th>HL7 Label</th>
                        <th>JSON Path</th>
                        <th></th>
                      </tr>
                    </thead>
                    <tbody>
                      {mappings.map((m) => {
                        const mandatory = isMandatoryField(m.segment, m.field);
                        return (
                          <tr key={`${m.segment}-${m.field}`}>
                            <td className="mono">
                              {m.segment}-{m.field}
                            </td>
                            <td>{mandatory ? "*" : ""}</td>
                            <td>{getFieldLabel(m.segment, m.field)}</td>
                            <td className="mono">{m.sourcePath}</td>
                            <td className="right">
                              <button
                                className="link"
                                type="button"
                                onClick={() => removeMapping(m.segment, m.field)}
                              >
                                Remove
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>

          <div className="panel">
            <div className="panel-title">HL7 Mapping</div>

            <div className="hl7-controls" role="region" aria-label="HL7 Controls">
              <div className="control">
                <label className="label small" htmlFor="hl7-version">
                  HL7 Version
                </label>
                <select
                  id="hl7-version"
                  className="select"
                  value={hl7Version}
                  onChange={(e) => setHl7Version(e.target.value)}
                >
                  {SUPPORTED_HL7_VERSIONS.map((v) => (
                    <option key={v} value={v}>
                      v{v}
                    </option>
                  ))}
                </select>
              </div>

              <div className="control">
                <label className="label small" htmlFor="hl7-segment">
                  Segment
                </label>
                <select
                  id="hl7-segment"
                  className="select"
                  value={targetSegment}
                  onChange={(e) => setTargetSegment(e.target.value)}
                >
                  {filteredSegmentIds.map((segmentId) => (
                    <option key={segmentId} value={segmentId}>
                      {segmentId}
                      {MANDATORY_SEGMENTS.includes(segmentId) ? " *" : ""}
                    </option>
                  ))}
                </select>
              </div>

              <div className="control control-wide">
                <label className="label small" htmlFor="segment-filter">
                  Filter
                </label>
                <input
                  id="segment-filter"
                  className="input"
                  value={segmentSearch}
                  onChange={(e) => setSegmentSearch(e.target.value)}
                  placeholder="Filter segments (e.g. PID, OBX)"
                  aria-label="Filter segments"
                />
              </div>
            </div>

            <div className="hint">
              Fields: <span className="mono">{HL7_SCHEMAS[targetSegment]?.maxField || 0}</span>
              {HL7_SCHEMAS[targetSegment]?.description
                ? ` - ${HL7_SCHEMAS[targetSegment].description}`
                : ""}
            </div>

            <div className="hint">
              Drag a JSON field from the left panel and drop it onto an HL7 field row.
              Mandatory fields are marked with <span className="mandatory-star">*</span>.
            </div>

            <div className="fields">
              <div className="fields-header">
                <div>Field</div>
                <div>HL7 Label</div>
                <div>Mapped JSON</div>
                <div></div>
              </div>
              {Array.from(
                { length: HL7_SCHEMAS[targetSegment]?.maxField || 0 },
                (_, idx) => idx + 1
              ).map(
                (fieldNumber) => {
                  const mappedPath = getMappedPathForField(targetSegment, fieldNumber);
                  const mandatory = isMandatoryField(targetSegment, fieldNumber);
                  const mapped = Boolean(mappedPath);
                  return (
                    <div
                      key={`${targetSegment}-${fieldNumber}`}
                      className={[
                        "field-row",
                        mapped ? "mapped" : "",
                        mandatory ? "mandatory" : ""
                      ]
                        .filter(Boolean)
                        .join(" ")}
                      onDragOver={(e) => {
                        e.preventDefault();
                        e.dataTransfer.dropEffect = "copy";
                      }}
                      onDrop={(e) => {
                        e.preventDefault();
                        const dropped =
                          e.dataTransfer.getData("application/x-hl7-jsonpath") ||
                          e.dataTransfer.getData("text/plain");
                        const { path, error: dropError } = coerceDroppedPathWithJson({
                          droppedText: dropped,
                          selectedObjectBasePath,
                          jsonData
                        });
                        if (dropError) {
                          setError(dropError);
                          return;
                        }
                        if (!path) return;
                        if (!jsonData || jsonParseError) {
                          setError(jsonParseError || "Enter valid JSON before mapping");
                          return;
                        }
                        addOrReplaceMapping({
                          segment: targetSegment,
                          field: fieldNumber,
                          sourcePath: path
                        });
                      }}
                      title="Drop a JSON field here to map"
                      role="button"
                      tabIndex={0}
                    >
                      <div className="mono">
                        {targetSegment}-{fieldNumber}
                        {mandatory ? <span className="mandatory-star">*</span> : null}
                      </div>
                      <div>{getFieldLabel(targetSegment, fieldNumber)}</div>
                      <div className="mono truncate" title={mappedPath || ""}>
                        {mappedPath || "-"}
                      </div>
                      <div className="right">
                        {mapped ? (
                          <button
                            className="mini danger"
                            type="button"
                            onClick={(ev) => {
                              ev.stopPropagation();
                              removeMapping(targetSegment, fieldNumber);
                            }}
                          >
                            Clear
                          </button>
                        ) : (
                          <button
                            className="mini"
                            type="button"
                            disabled={!selectedKeyPath}
                            onClick={(ev) => {
                              ev.stopPropagation();
                              mapSelectedKeyToField(targetSegment, fieldNumber);
                            }}
                            title={
                              selectedKeyPath
                                ? `Map ${selectedKeyPath} to ${targetSegment}-${fieldNumber}`
                                : "Select a JSON key to enable mapping"
                            }
                          >
                            Map
                          </button>
                        )}
                      </div>
                    </div>
                  );
                }
              )}
            </div>
          </div>
        </div>

        <div className="panel output-panel" aria-label="HL7 Output">
          <div className="panel-title">Output</div>
          <div className="output-panel-body">
            <div className="output-actions">
              <button className="button primary" type="button" onClick={generateHL7FromMappings}>
                Generate HL7
              </button>
              <button
                className="mini"
                type="button"
                onClick={copyHl7ToClipboard}
                disabled={!hl7Output}
              >
                {copied ? "Copied" : "Copy"}
              </button>
            </div>

            {error && <div className="error">{error}</div>}

            <label className="label">HL7 Output</label>
            <textarea
              className="textarea hl7 output"
              value={hl7Output}
              readOnly
              placeholder="HL7 output appears here..."
            />
          </div>
        </div>
      </div>
    </div>
  );
}

export default App;
