const https = require('https');
const CK  = process.env.ANTHROPIC_KEY;
const UT  = process.env.B44_TOKEN;
const SI  = process.env.SUB_ID;
const APP = process.env.APP_ID;

function get(host, path, token) {
  return new Promise((res, rej) => {
    const r = https.request(
      { hostname: host, path, method: 'GET', headers: { Authorization: 'Bearer ' + token } },
      rs => { let d = ''; rs.on('data', x => d += x); rs.on('end', () => { try { res(JSON.parse(d)); } catch { res({}); } }); }
    );
    r.on('error', rej); r.end();
  });
}

function post(host, path, token, body) {
  return new Promise((res, rej) => {
    const d = JSON.stringify(body);
    const r = https.request(
      { hostname: host, path, method: 'POST',
        headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(d) } },
      rs => { let x = ''; rs.on('data', c => x += c); rs.on('end', () => { try { res({ s: rs.statusCode, b: JSON.parse(x) }); } catch { res({ s: rs.statusCode, b: x }); } }); }
    );
    r.on('error', rej); r.write(d); r.end();
  });
}

const SYSTEM_PROMPT = 'Voce e um especialista em analise de oleo isolante para equipamentos eletricos. Sua unica tarefa e extrair dados de laudos de ensaio (PDF) e retornar um JSON estruturado. REGRAS: 1. Retorne APENAS o JSON sem markdown. 2. tipo_laudo: cromatografia, fisico_quimico ou completo. 3. Datas YYYY-MM-DD. 4. Numeros como number nao string. 5. Campos ausentes = null. 6. ND = nao_detectado:true e valor null. 7. status_diagnostico: Normal, Atencao, Urgente, Critico ou Indeterminado. ESTRUTURA CROMATOGRAFIA: { "tipo_laudo":"cromatografia", "equipamento":{"numero_serie":string,"identificacao":string,"tipo_equipamento":string,"fabricante":null,"ano_fabricacao":null,"instalacao":string,"classe_tensao_kv":null,"tensao_kv":null,"potencia_kva":null,"volume_oleo_litros":null,"tipo_oleo":null,"sistema_refrigeracao":null,"sistema_preservacao":null,"tipo_comutador":null}, "coleta":{"data_coleta":"YYYY-MM-DD","motivo":null,"ponto_amostragem":null,"temperatura_ambiente_c":null,"temperatura_oleo_c":null,"temperatura_amostra_c":null,"temperatura_enrolamento_c":null,"umidade_relativa_pct":null,"em_operacao":null,"observacoes":null}, "metadados":{"numero_relatorio":string,"data_recebimento_amostra":null,"data_analise":null,"data_emissao":string,"laboratorio":string,"responsavel_tecnico":null,"norma_referencia":null,"status_diagnostico":"Normal","diagnostico_texto":null,"proxima_reamostragem":null}, "gases":{"hidrogenio_h2":{"valor_atual_ppm":null,"valor_anterior_ppm":null,"data_anterior":null,"taxa_crescimento_pct_mes":null,"nao_detectado":false},"oxigenio_o2":{"valor_atual_ppm":null,"valor_anterior_ppm":null,"data_anterior":null,"taxa_crescimento_pct_mes":null,"nao_detectado":false},"nitrogenio_n2":{"valor_atual_ppm":null,"valor_anterior_ppm":null,"data_anterior":null,"taxa_crescimento_pct_mes":null,"nao_detectado":false},"metano_ch4":{"valor_atual_ppm":null,"valor_anterior_ppm":null,"data_anterior":null,"taxa_crescimento_pct_mes":null,"nao_detectado":false},"monoxido_carbono_co":{"valor_atual_ppm":null,"valor_anterior_ppm":null,"data_anterior":null,"taxa_crescimento_pct_mes":null,"nao_detectado":false},"dioxido_carbono_co2":{"valor_atual_ppm":null,"valor_anterior_ppm":null,"data_anterior":null,"taxa_crescimento_pct_mes":null,"nao_detectado":false},"etileno_c2h4":{"valor_atual_ppm":null,"valor_anterior_ppm":null,"data_anterior":null,"taxa_crescimento_pct_mes":null,"nao_detectado":false},"etano_c2h6":{"valor_atual_ppm":null,"valor_anterior_ppm":null,"data_anterior":null,"taxa_crescimento_pct_mes":null,"nao_detectado":false},"acetileno_c2h2":{"valor_atual_ppm":null,"valor_anterior_ppm":null,"data_anterior":null,"taxa_crescimento_pct_mes":null,"nao_detectado":false},"total_gases":{"valor_atual_ppm":null,"valor_anterior_ppm":null,"data_anterior":null,"taxa_crescimento_pct_mes":null,"nao_detectado":false},"total_gases_combustiveis":{"valor_atual_ppm":null,"valor_anterior_ppm":null,"data_anterior":null,"taxa_crescimento_pct_mes":null,"nao_detectado":false}} } ESTRUTURA FISICO-QUIMICO: { "tipo_laudo":"fisico_quimico", "equipamento":{igual}, "coleta":{igual}, "metadados":{igual}, "fisico_quimico":{"teor_agua_ppm":{"valor_atual":null,"valor_anterior":null,"data_anterior":null,"limite_norma":null,"norma":null},"fator_perdas_dieletricas_100c_pct":{"valor_atual":null,"valor_anterior":null,"data_anterior":null,"limite_norma":null,"norma":null},"rigidez_dieletrica_kv":{"valor_atual":null,"valor_anterior":null,"data_anterior":null,"limite_norma":null,"norma":null},"indice_neutralizacao_mgkoh_g":{"valor_atual":null,"valor_anterior":null,"data_anterior":null,"limite_norma":null,"norma":null},"tensao_interfacial_mn_m":{"valor_atual":null,"valor_anterior":null,"data_anterior":null,"limite_norma":null,"norma":null},"cor":{"valor_atual":null,"valor_anterior":null,"data_anterior":null,"norma":null},"densidade_20_4_g_ml":{"valor_atual":null,"valor_anterior":null,"data_anterior":null,"norma":null},"aspecto_visual":{"valor_atual":null,"valor_anterior":null,"data_anterior":null},"furfural_mg_l":{"valor_atual":null,"valor_anterior":null,"data_anterior":null,"limite_norma":null,"norma":null}} } Para COMPLETO inclua gases e fisico_quimico juntos com tipo_laudo completo.';

exports.handler = async (ev) => {
  const cors = {'Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'Content-Type','Access-Control-Allow-Methods':'POST,OPTIONS','Content-Type':'application/json'};
  if (ev.httpMethod === 'OPTIONS') return { statusCode: 200, headers: cors, body: '' };
  try {
    const { pdf_base64, filename } = JSON.parse(ev.body || '{}');
    if (!pdf_base64) return { statusCode: 400, headers: cors, body: JSON.stringify({ error: 'pdf_base64 required' }) };

    const rb = JSON.stringify({ model: 'claude-sonnet-4-6', max_tokens: 4000, system: SYSTEM_PROMPT,
      messages: [{ role: 'user', content: [
        { type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: pdf_base64 } },
        { type: 'text', text: 'Extraia todos os dados deste laudo e retorne o JSON. Nao inclua texto alem do JSON.' }
      ]}]
    });

    const air = await new Promise((res, rej) => {
      const r = https.request({ hostname: 'api.anthropic.com', path: '/v1/messages', method: 'POST',
        headers: { 'x-api-key': CK, 'anthropic-version': '2023-06-01', 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(rb) }
      }, rs => { let d = ''; rs.on('data', x => d += x); rs.on('end', () => { try { res(JSON.parse(d)); } catch (e) { rej(new Error(d.slice(0,200))); } }); });
      r.on('error', rej); r.write(rb); r.end();
    });

    if (air.error) throw new Error(air.error.message);
    const data = JSON.parse(air.content[0].text.replace(/```json|```/g,'').trim());
    if (!data.tipo_laudo || !data.equipamento || !data.coleta || !data.metadados) throw new Error('JSON invalido: campos obrigatorios ausentes');

    let transformer_id = null;
    const ns = data.equipamento.numero_serie;
    if (ns) {
      const sr = await get('app.oilssense.com', '/api/apps/'+APP+'/entities/Transformer?numero_serie='+encodeURIComponent(ns)+'&limit=1', UT);
      const rs = Array.isArray(sr) ? sr : (sr.results || []);
      if (rs[0] && rs[0].id) { transformer_id = rs[0].id; }
      else {
        const cr = await post('app.oilssense.com', '/api/apps/'+APP+'/entities/Transformer', UT, {
          numero_serie: ns, identificacao: data.equipamento.identificacao||ns,
          tipo_equipamento: data.equipamento.tipo_equipamento, fabricante: data.equipamento.fabricante,
          potencia_kva: data.equipamento.potencia_kva, tensao_kv: data.equipamento.tensao_kv,
          instalacao: data.equipamento.instalacao, subscription_id: SI
        });
        transformer_id = cr.b && cr.b.id;
      }
    }

    const pl = {
      transformer_id, subscription_id: SI, tipo_laudo: data.tipo_laudo,
      data_coleta: data.coleta.data_coleta, numero_laudo: data.metadados.numero_relatorio,
      laboratorio: data.metadados.laboratorio, status_diagnostico: data.metadados.status_diagnostico,
      diagnostico_texto: data.metadados.diagnostico_texto, proxima_reamostragem: data.metadados.proxima_reamostragem,
      oil_type: data.equipamento.tipo_oleo || 'Mineral'
    };

    if (data.gases) {
      const g = data.gases;
      pl.h2=g.hidrogenio_h2?.valor_atual_ppm; pl.ch4=g.metano_ch4?.valor_atual_ppm;
      pl.c2h2=g.acetileno_c2h2?.valor_atual_ppm; pl.c2h4=g.etileno_c2h4?.valor_atual_ppm;
      pl.c2h6=g.etano_c2h6?.valor_atual_ppm; pl.co=g.monoxido_carbono_co?.valor_atual_ppm;
      pl.co2=g.dioxido_carbono_co2?.valor_atual_ppm;
      pl.h2_anterior=g.hidrogenio_h2?.valor_anterior_ppm; pl.ch4_anterior=g.metano_ch4?.valor_anterior_ppm;
      pl.c2h2_anterior=g.acetileno_c2h2?.valor_anterior_ppm; pl.c2h4_anterior=g.etileno_c2h4?.valor_anterior_ppm;
      pl.c2h6_anterior=g.etano_c2h6?.valor_anterior_ppm; pl.co_anterior=g.monoxido_carbono_co?.valor_anterior_ppm;
      pl.co2_anterior=g.dioxido_carbono_co2?.valor_anterior_ppm;
      pl.data_coleta_anterior=g.hidrogenio_h2?.data_anterior;
      pl.total_gases_combustiveis=g.total_gases_combustiveis?.valor_atual_ppm;
    }
    if (data.fisico_quimico) {
      const fq = data.fisico_quimico;
      pl.teor_agua_ppm=fq.teor_agua_ppm?.valor_atual; pl.rigidez_dieletrica_kv=fq.rigidez_dieletrica_kv?.valor_atual;
      pl.fator_perdas_dieletricas=fq.fator_perdas_dieletricas_100c_pct?.valor_atual;
      pl.indice_neutralizacao=fq.indice_neutralizacao_mgkoh_g?.valor_atual;
      pl.tensao_interfacial=fq.tensao_interfacial_mn_m?.valor_atual;
      pl.cor=fq.cor?.valor_atual; pl.densidade=fq.densidade_20_4_g_ml?.valor_atual;
      pl.aspecto_visual=fq.aspecto_visual?.valor_atual; pl.furfural=fq.furfural_mg_l?.valor_atual;
    }

    const sv = await post('app.oilssense.com', '/api/apps/'+APP+'/entities/LabAnalysis', UT, pl);
    if (sv.b && sv.b.message && !sv.b.id) throw new Error(sv.b.message);
    return { statusCode: 200, headers: cors, body: JSON.stringify({ success: true, data, id: sv.b&&sv.b.id, transformer_id, filename: filename||null }) };
  } catch(e) {
    return { statusCode: 500, headers: cors, body: JSON.stringify({ error: e.message||'Erro interno' }) };
  }
};
