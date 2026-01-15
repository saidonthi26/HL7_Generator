const express = require('express');
const cors = require('cors');
const normalizeKeys = require('./utils/normalizeKeys');
const validatePatient = require('./validation/validatePatient');
const buildMSH = require('./hl7/msh');
const buildPID = require('./hl7/pid');
const buildPV1 = require('./hl7/pv1');

const app = express();
app.use(cors());
app.use(express.json());

app.listen(3000, () => {
  console.log('HL7 backend running on port 3000');
});

app.post('/convert', (req, res) => {
  const data = normalizeKeys(req.body);

  const error = validatePatient(data);
  if (error) {
    return res.status(400).json({ error });
  }

  const hl7 =
    buildMSH() + '\n' +
    buildPID(data) + '\n' +
    buildPV1();

  res.send(hl7);
});
