# HL7 Generator — JSON to HL7 v2

This project is a React (Create React App) frontend that generates HL7 v2 (ADT_A01-style) messages from JSON by mapping JSON paths to HL7 segment fields.

## Features

- HL7 version-aware segment/field list (via `hl7-dictionary`)
- Map JSON paths to HL7 fields (drag & drop or Map button)
- Mandatory field highlighting/validation
- Generates HL7 output and supports copy-to-clipboard

## Supported HL7 Versions

Based on `hl7-dictionary`, this app supports HL7 v2 definitions for:

- `2.1`, `2.2`, `2.3`, `2.3.1`, `2.4`, `2.5`, `2.5.1`, `2.6`, `2.7`, `2.7.1`

## Supported Segments

- `MSH`, `PID`, `PV1`, `NK1`, `AL1`, `OBR`, `OBX`
- Optional segments are included only when you map at least one field for that segment.

## Example JSON (Nested Objects + Arrays)

```json
{
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
  "nextOfKin": [{ "name": "Anita Kumar", "relationship": "SPO", "phone": "8888888888" }]
}
```

## Run

```bash
cd React
npm install
npm start
```

The dev server usually runs at `http://localhost:3000` (or the next available port).

## Test

```bash
cd React
npm test
```

