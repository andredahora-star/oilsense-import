const https = require('https');
const CK = process.env.ANTHROPIC_KEY;

const SYSTEM_PROMPT = 'Voce e um especialista em analise de oleo isolante. Extraia os dados do laudo PDF e retorne APENAS JSON sem markdown. tipo_laudo: cromatografia, fisico_quimico ou completo. Datas YYYY-MM-DD. Numeros como number. Campos ausentes = null. ND = nao_detectado:true. status_diagnostico: Normal, Atencao, Urgente, Critico ou Indeterminado. ESTRUTURA: { "tipo_laudo": string, "equipamento": { "numero_serie": string, "identificacao": string, "tipo_equipamento": string, "fabricante": string|null, "instalacao": string, "tensao_kv": string|null, "potencia_kva": number|null, "tipo_oleo": string|null }, "coleta": { "data_coleta": "YYYY-MM-DD", "motivo": string|null }, "metadados": { "numero_relatorio": string, "data_emissao": string, "laboratorio": string, "status_diagnostico": string, "diagnostico_texto": string|null, "proxima_reamostragem": string|null }, "gases": { "hidrogenio_h2": { "valor_atual_ppm": number|null, "valor_anterior_ppm": number|null, "data_anterior": string|null, "nao_detectado": false }, "metano_ch4": { "valor_atual_ppm": number|null, "valor_anterior_ppm": number|null, "data_anterior": string|null, "nao_detectado": false }, "acetileno_c2h2": { "valor_atual_ppm": number|null, "valor_anterior_ppm": number|null, "data_anterior": string|null, "nao_detectado": false }, "etileno_c2h4": { "valor_atual_ppm": number|null, "valor_anterior_ppm": number|null, "data_anterior": string|null, "nao_detectado": false }, "etano_c2h6": { "valor_atual_ppm": number|null, "valor_anterior_ppm": number|null, "data_anterior": string|null, "nao_detectado": false }, "monoxido_carbono_co": { "valor_atual_ppm": number|null, "valor_anterior_ppm": number|null, "data_anterior": string|null, "nao_detectado": false }, "dioxido_carbono_co2": { "valor_atual_ppm": number|null, "valor_anterior_ppm": number|null, "data_anterior": string|null, "nao_detectado": false }, "total_gases_combustiveis": { "valor_atual_ppm": number|null, "nao_detectado": false } }, "fisico_quimico": { "teor_agua_ppm": { "valor_atual": number|null, "valor_anterior": number|null, "data_anterior": string|null, "limite_norma": number|null }, "rigidez_dieletrica_kv": { "valor_atual": number|null, "valor_anterior": number|null, "data_anterior": string|null, "limite_norma": number|null }, "fator_perdas_dieletricas_100c_pct": { "valor_atual": number|null, "valor_anterior": number|null }, "indice_neutralizacao_mgkoh_g": { "valor_atual": number|null, "valor_anterior": number|null }, "tensao_interfacial_mn_m": { "valor_atual": number|null, "valor_anterior": number|null }, "cor": { "valor_atual": number|null }, "densidade_20_4_g_ml": { "valor_atual": number|null }, "aspecto_visual": { "valor_atual": string|null }, "furfural_mg_l": { "valor_atual": number|null } } }';

exports.handler = async (ev) => {
  const cors = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'POST,OPTIONS',
    'Content-Type': 'application/json'
  };
  if (ev.httpMethod === 'OPTIONS') return { statusCode: 200, headers: cors, body: '' };
  try {
    const { pdf_base64, filename } = JSON.parse(ev.body || '{}');
    if (!pdf_base64) return { statusCode: 400, headers: cors, body: JSON.stringify({ error: 'pdf_base64 required' }) };

    // Strip prefixo data URL se presente
    const clean = pdf_base64.includes(',') ? pdf_base64.split(',')[1] : pdf_base64;

    const rb = JSON.stringify({
      model: 'claude-sonnet-4-6',
      max_tokens: 4000,
      system: SYSTEM_PROMPT,
      messages: [{ role: 'user', content: [
        { type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: clean } },
        { type: 'text', text: 'Extraia os dados do laudo e retorne o JSON.' }
      ]}]
    });

    const air = await new Promise((res, rej) => {
      const r = https.request({
        hostname: 'api.anthropic.com', path: '/v1/messages', method: 'POST',
        headers: { 'x-api-key': CK, 'anthropic-version': '2023-06-01', 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(rb) }
      }, rs => {
        let d = '';
        rs.on('data', x => d += x);
        rs.on('end', () => { try { res(JSON.parse(d)); } catch (e) { rej(new Error(d.slice(0, 200))); } });
      });
      r.on('error', rej);
      r.write(rb);
      r.end();
    });

    if (air.error) throw new Error(air.error.message);

    const rawText = air.content[0].text.replace(/```json|```/g, '').trim();
    const data = JSON.parse(rawText);

    if (!data.tipo_laudo || !data.equipamento || !data.coleta || !data.metadados) {
      throw new Error('JSON invalido: campos obrigatorios ausentes');
    }

    // Retorna apenas os dados extraidos - o frontend salva no Base44
    return {
      statusCode: 200,
      headers: cors,
      body: JSON.stringify({ success: true, data, filename: filename || null })
    };

  } catch (e) {
    return { statusCode: 500, headers: cors, body: JSON.stringify({ error: e.message || 'Erro interno' }) };
  }
};
