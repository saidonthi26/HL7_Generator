function buildPID(data) {
  const fields = [];

  fields[1] = '1';                     // PID-1
  fields[3] = data.patientid;          // PID-3 (mandatory)
  fields[5] = data.name;               // PID-5 (mandatory)
  fields[7] = data.age;                // PID-7 (mandatory per your rule)
  fields[8] = data.gender;             // PID-8 (mandatory)

  // Optional fields (only if present)
  if (data.phone) fields[13] = data.phone;
  if (data.address) fields[11] = data.address;

  let pid = 'PID';
  for (let i = 1; i <= 13; i++) {
    pid += '|' + (fields[i] || '');
  }

  return pid;
}

module.exports = buildPID;
