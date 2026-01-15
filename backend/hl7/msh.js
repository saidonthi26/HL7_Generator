const { v4: uuid } = require('uuid');

function buildMSH() {
  const timestamp = new Date()
    .toISOString()
    .replace(/[-:]/g, '')
    .slice(0, 14);

  return `MSH|^~\\&|NODEAPP|HOSP|HL7SYS|HOSP|${timestamp}||ADT^A01|${uuid()}|P|2.3`;
}

module.exports = buildMSH;
