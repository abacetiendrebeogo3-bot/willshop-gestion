const token = 'base64-eyJhY2Nlc3NfdG9rZW4iOiJleUpoYkdjaU9pSklVekkxTmlJc0luUjVjQ0k2SWtwWFZDSjkuZXlKcGMyTWlPaUp6ZFhCaFltRnpaU0lzSW5KbFppSTZJbk4wWW5wallXNWpjSFpuY1dSd2VXSmpjbTFuSWl3aWNtOXNaU0k2SW5WemRYSWlMQ0pwWVhRaU9qRTNNemczTWpVNE5Ua3NJbVY0Y0NJNk1qQTFOakUwTnpnMU9YMC5Jb1F1bFRoTjA0TjBNYkcwQTRyUUpLcmN2bVR6Zl96dXVqblpQZ0d2VDR3In0=';
let rawVal = token;

if (rawVal.startsWith('base64-')) {
  rawVal = Buffer.from(rawVal.substring(7), 'base64').toString('utf8');
}
console.log("Decoded:", rawVal);

let accessToken = '';
if (rawVal.startsWith('{') || rawVal.startsWith('[')) {
  const parsed = JSON.parse(rawVal);
  accessToken = parsed.access_token || parsed.currentSession?.access_token || '';
}

console.log("Access Token:", accessToken);

const parts = accessToken.split('.');
const payloadBase64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
const payloadJson = Buffer.from(payloadBase64, 'base64').toString('utf8');
const payload = JSON.parse(payloadJson);
console.log("Payload:", payload);
