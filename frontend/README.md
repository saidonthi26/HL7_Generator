# HL7 Generator – JSON to HL7 v2 Converter

This project is a **full-stack application** that converts **patient data in JSON format** into **HL7 v2 (ADT_A01) messages**.

It is built as a **learning and proof-of-concept (POC) project** to understand HL7 v2 structure, mandatory vs optional field handling, and frontend–backend integration.

## What This Application Does

- Accepts **patient JSON input**
- Validates **mandatory fields**
- Ignores **case sensitivity** in JSON keys
- Generates a valid **HL7 v2 message**
- Skips missing optional fields using empty HL7 separators (`||`)
- Displays HL7 output in a **simple medical / hospital-themed UI**

## Tech Stack

### Backend
- Node.js
- Express.js
- REST API
- Manual HL7 v2 message generation

### Frontend
- React (Create React App)
- Fetch API
- Simple medical-themed UI

## Project Structure

HL7_Generator/
├── backend/
│ ├── index.js
│ ├── hl7/
│ ├── validation/
│ ├── package.json
│ └── .gitignore
│
├── frontend/
│ ├── src/
│ ├── public/
│ ├── package.json
│ └── .gitignore


**Note**
- There is **no root `.gitignore`**
- `frontend` and `backend` each maintain their own `.gitignore`


## Input JSON Rules

### Mandatory Fields (Case-Insensitive)

The following fields **must be present** in the JSON input:

- `patientId`
- `name`
- `age`
- `gender`

Valid examples:
{
  "PatientID": "P1001",
  "Name": "Ravi Kumar",
  "Age": 30,
  "Gender": "M"
}
{
  "patientid": "P1002",
  "name": "Anita Sharma",
  "age": 28,
  "gender": "F"
}

## Sample HL7 Output

MSH|^~\&|NODEAPP|HOSP|HL7SYS|HOSP|20260115||ADT^A01|MSG001|P|2.3
PID|1||P1001||Ravi Kumar|30|M|||||
PV1|1|O

## Run Backend Steps 

cd backend
npm install
node index.js

 - runs on : http://localhost:3000
 
## Runn Frontend 

cd frontend
npm install
npm start

 - runs on : http://localhost:3001

## Test API (POSTMAN)

Method : POST

http://localhost:3000/convert

Body(JSON)

{
  "PatientID": "P1001",
  "Name": "Ravi Kumar",
  "Age": 30,
  "Gender": "M"
}

## Key Decisions 

- HL7 v2 formatting is respected
- Empty fields (||) are preferred over placeholders like UNKNOWN
- Case insensitive JSON key handling
- Frontend and backend are maintained in a single Git repository
- Separate .gitignore files for frontend and backend

## Notes
- node_modules folders are ignored using local .gitignore files
- No HL7 libraries are used HL7 messages are generated manually
- Focus is on clarity and correctness, not complexity

## Author

**This is Application is developed by Sai Donthi, Mail: saidonthi40@gmail.com** 
