// netlify/functions/gemini.js
// Netlify Function: proxies client requests to Hugging Face Inference API
// Reads HF_API_KEY (and optional HF_MODEL) from process.env (set in Netlify site settings)

const fetch = (...args) => import('node-fetch').then(({ default: f }) => f(...args));

exports.handler = async (event) => {
  try {
    if (event.httpMethod !== 'POST') {
      return { statusCode: 405, body: JSON.stringify({ error: 'Method Not Allowed' }) };
    }

    const bodyData = event.body ? JSON.parse(event.body) : {};
    const prompt = bodyData.prompt;
    const strategy = bodyData.strategy || 'Maintain';

    if (!prompt) {
      return { statusCode: 400, body: JSON.stringify({ error: 'prompt required' }) };
    }

    const key = process.env.HF_API_KEY;
    if (!key) {
      return { statusCode: 500, body: JSON.stringify({ error: 'HF_API_KEY not configured' }) };
    }

    const model = process.env.HF_MODEL || 'google/flan-t5-large';
    const hfUrl = `https://https://router.huggingface.co/models/${encodeURIComponent(model)}`;

    const payload = {
      inputs: `You are an elite sports nutritionist. User strategy: ${strategy}.\nQuestion: ${prompt}`,
      parameters: { max_new_tokens: 256, temperature: 0.7 }
    };

    const r = await fetch(hfUrl, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${key}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    });

    const data = await r.json();

    // Extract generated text from common HF response shapes
    let generated = '';
    if (Array.isArray(data) && data[0] && data[0].generated_text) {
      generated = data[0].generated_text;
    } else if (data && typeof data === 'object' && data.generated_text) {
      generated = data.generated_text;
    } else if (data && data.error) {
      return { statusCode: r.status || 500, body: JSON.stringify({ error: data.error }) };
    } else if (typeof data === 'string') {
      generated = data;
    } else {
      // Fallback: try to stringify useful fields
      try { generated = JSON.stringify(data); } catch (e) { generated = 'Unable to parse model response'; }
    }

    const shaped = {
      candidates: [ { content: { parts: [ { text: generated } ] } } ],
      raw: data
    };

    return { statusCode: 200, body: JSON.stringify(shaped) };
  } catch (err) {
    console.error('Netlify function error:', err);
    return { statusCode: 500, body: JSON.stringify({ error: 'server error' }) };
  }
};
