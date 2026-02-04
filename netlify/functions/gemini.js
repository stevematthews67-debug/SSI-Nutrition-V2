// netlify/functions/gemini.js
// Netlify Function: proxies client requests to Hugging Face Inference API (OpenAI-compatible)
// Reads HF_API_KEY (and optional HF_MODEL) from process.env

exports.handler = async (event) => {
  try {
    if (event.httpMethod === 'GET') {
      return {
        statusCode: 200,
        body: JSON.stringify({
          status: 'ok',
          message: 'Gemini function is ready',
          key_configured: !!process.env.HF_API_KEY,
          model: process.env.HF_MODEL || 'default'
        })
      };
    }

    if (event.httpMethod !== 'POST') {
      return { statusCode: 405, body: JSON.stringify({ error: 'Method Not Allowed' }) };
    }

    let bodyData = {};
    try {
      const rawBody = event.isBase64Encoded 
        ? Buffer.from(event.body, 'base64').toString('utf-8') 
        : event.body;
      bodyData = rawBody ? JSON.parse(rawBody) : {};
    } catch (parseErr) {
      console.error('JSON Parse Error:', parseErr);
      return { statusCode: 400, body: JSON.stringify({ error: 'Invalid JSON body' }) };
    }

    const prompt = bodyData.prompt;
    const strategy = bodyData.strategy || 'Maintain';

    if (!prompt) {
      return { statusCode: 400, body: JSON.stringify({ error: 'prompt required' }) };
    }

    const key = process.env.HF_API_KEY;
    if (!key) {
      return { statusCode: 500, body: JSON.stringify({ error: 'HF_API_KEY not configured' }) };
    }

    // Use a modern, working model as default. Llama-3.2-1B-Instruct is fast and available.
    const model = process.env.HF_MODEL || 'meta-llama/Llama-3.2-1B-Instruct';
    const hfUrl = `https://router.huggingface.co/v1/chat/completions`;

    const payload = {
      model: model,
      messages: [
        { role: 'system', content: `You are an elite sports nutritionist. User strategy: ${strategy}.` },
        { role: 'user', content: prompt }
      ],
      max_tokens: 512,
      temperature: 0.7
    };

    console.log(`Calling HF Router with model: ${model}`);

    const r = await fetch(hfUrl, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${key}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    });

    const data = await r.json();

    if (!r.ok) {
      console.error('HF API Error:', r.status, data);
      return { 
        statusCode: r.status, 
        body: JSON.stringify({ error: `HF API error: ${r.status}`, details: data }) 
      };
    }

    // Extract text from OpenAI-compatible response shape
    let generated = '';
    if (data.choices && data.choices[0] && data.choices[0].message) {
      generated = data.choices[0].message.content;
    } else {
      generated = 'Unable to parse model response';
    }

    // Shape the response to match what the frontend expects (Gemini format)
    const shaped = {
      candidates: [ { content: { parts: [ { text: generated } ] } } ],
      raw: data
    };

    return { 
      statusCode: 200, 
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(shaped) 
    };
  } catch (err) {
    console.error('Netlify function error:', err);
    return { statusCode: 500, body: JSON.stringify({ error: `Server error: ${err.message}` }) };
  }
};
