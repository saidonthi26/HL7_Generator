import { useState } from "react";
import "./App.css";

function App() {
  const [jsonInput, setJsonInput] = useState(`{
  "PatientID": "P1001",
  "Name": "Ravi Kumar",
  "Age": 30,
  "Gender": "M"
}`);
  const [hl7Output, setHl7Output] = useState("");
  const [error, setError] = useState("");

  const convertToHL7 = async () => {
    setError("");
    setHl7Output("");

    try {
      const response = await fetch("http://localhost:3000/convert", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: jsonInput
      });

      if (!response.ok) {
        const err = await response.json();
        setError(err.error);
        return;
      }

      const hl7 = await response.text();
      setHl7Output(hl7);
    } catch {
      setError("Unable to connect to backend");
    }
  };

  return (
    <div className="app-container">
      <div className="card">
        <h1 className="title">🏥 HL7 Patient Converter</h1>
        <p className="subtitle">
          Convert patient JSON data into HL7 v2 format
        </p>

        <label className="label">Patient JSON Input</label>
        <textarea
          className="textarea"
          rows="8"
          value={jsonInput}
          onChange={(e) => setJsonInput(e.target.value)}
        />

        <button className="button" onClick={convertToHL7}>
          Convert to HL7
        </button>

        {error && <div className="error">{error}</div>}

        {hl7Output && (
          <>
            <label className="label">HL7 Output</label>
            <textarea
              className="textarea hl7"
              rows="7"
              value={hl7Output}
              readOnly
            />
          </>
        )}
      </div>
    </div>
  );
}

export default App;
