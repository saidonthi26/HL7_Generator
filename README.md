# HL7 Generator (JSON → HL7 v2)

A React app to generate HL7 v2 messages from JSON by mapping JSON paths to HL7 segment fields (drag & drop).

## Features

- HL7 version-aware segment/field list (via `hl7-dictionary`)
- Map JSON keys/paths to HL7 fields (drag & drop or Map button)
- Mandatory field highlighting/validation
- Generates HL7 output and supports copy-to-clipboard

## Project Structure

- `React/` — React (Create React App) frontend
- No backend: HL7 generation runs in the browser

## Run

```bash
cd React
npm install
npm start
```

## Test

```bash
cd React
npm test
```

