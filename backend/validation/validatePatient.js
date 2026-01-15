const REQUIRED_FIELDS = ['patientid', 'name', 'age', 'gender'];

function validatePatient(data) {
  const missing = [];

  for (const field of REQUIRED_FIELDS) {
    if (data[field] === undefined || data[field] === null) {
      missing.push(field);
    }
  }

  if (missing.length > 0) {
    return `${missing.join(', ')} are mandatory`;
  }

  return null;
}

module.exports = validatePatient;
