// netlify/functions/gemini.js
// Netlify Function: proxies client requests to Google's Generative Language API
// Reads GEMINI_API_KEY from process.env (set in Netlify site settings)

const fetch = (...args) => import('node-fetch').then(({ default: f }) => f(...args));

exports.handler = async (event) => {
  try {
    const bodyData = event.body ? JSON.parse(event.body) : {};
    const prompt = bodyData.prompt;
    const strategy = bodyData.strategy || 'Maintain';

    if (!prompt) {
      return { statusCode: 400, body: JSON.stringify({ error: 'prompt required' }) };
    }

    const key = process.env.GEMINI_API_KEY;
    if (!key) {
      return { statusCode: 500, body: JSON.stringify({ error: 'API key not configured' }) };
    }

    const requestBody = {
      contents: [
        {
          parts: [
            {
              text: `You are an elite sports nutritionist. User strategy: ${strategy}.\nQuestion: ${prompt}`
            }
          ]
        }
      ]
    };

    const r = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${key}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody)
      }
    );

    const data = await r.json();
    return {
      statusCode: r.status >= 200 && r.status < 300 ? 200 : r.status,
      body: JSON.stringify(data)
    };
  } catch (err) {
    console.error('Netlify function error:', err);
    return { statusCode: 500, body: JSON.stringify({ error: 'server error' }) };
  }
};
