const https = require('https');
const CK = process.env.ANTHROPIC_KEY;
const UT = process.env.B44_TOKEN;
const SI = process.env.SUB_ID;
const APP = process.env.APP_ID;

exports.handler = async (ev) => {
  const cors = {'Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'Content-Type','Access-Control-Allow-Methods':'POST,OPTIONS','Content-Type':'application/json'};
  if (ev.httpMethod === 'OPTIONS') return { statusCode: 200, headers: cors, body: '' };
  try {
    const body = JSON.parse(ev.body || '{}');
    const { pdf_base64, filename } = body;
    if (!pdf_base64) return { statusCode: 400, headers: cors, body: JSON.stringify({ error: 'pdf_base64 required' }) };

    const hasPrefix = pdf_base64.includes(',');
    const prefix = hasPrefix ? pdf_base64.split(',')[0] : 'none';
    const cleanBase64 = hasPrefix ? pdf_base64.split(',')[1] : pdf_base64;
    const len = cleanBase64.length;
    const firstChars = cleanBase64.substring(0, 30);
    const isValidBase64 = /^[A-Za-z0-9+/]+=*$/.test(cleanBase64.substring(0, 100));

    const rb = JSON.stringify({ model: 'claude-sonnet-4-6', max_tokens: 50,
      messages: [{ role: 'user', content: [
        { type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: cleanBase64 } },
        { type: 'text', text: 'Say OK' }
      ]}]
    });

    const air = await new Promise((res, rej) => {
      const r = https.request({ hostname: 'api.anthropic.com', path: '/v1/messages', method: 'POST',
        headers: { 'x-api-key': CK, 'anthropic-version': '2023-06-01', 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(rb) }
      }, rs => { let d = ''; rs.on('data', x => d += x); rs.on('end', () => { try { res(JSON.parse(d)); } catch (e) { rej(new Error(d.slice(0,300))); } }); });
      r.on('error', rej); r.write(rb); r.end();
    });

    return { statusCode: 200, headers: cors, body: JSON.stringify({
      debug: { hasPrefix, prefix, len, firstChars, isValidBase64, filename, ck_set: !!CK },
      anthropic: air
    })};
  } catch(e) {
    return { statusCode: 500, headers: cors, body: JSON.stringify({ error: e.message }) };
  }
};
