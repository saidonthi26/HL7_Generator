import { render, screen } from "@testing-library/react";
import App from "./App";

test("renders HL7 generator UI", async () => {
  render(<App />);

  expect(screen.getByText("HL7 Generator")).toBeInTheDocument();
  expect(screen.getByText(/HL7 Mapping/i)).toBeInTheDocument();
  expect(screen.getByLabelText(/HL7 Version/i)).toBeInTheDocument();
  expect(screen.getByLabelText(/^Segment$/i)).toBeInTheDocument();
  expect(screen.getByLabelText(/Object \(top-level\)/i)).toBeInTheDocument();
  expect(screen.getByRole("button", { name: /generate hl7/i })).toBeInTheDocument();
});
