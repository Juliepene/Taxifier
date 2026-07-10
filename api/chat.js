// Serverless function (Vercel-style). Calls Google Gemini's free-tier API.
// Reshapes the response to look like an Anthropic Messages response so the
// front-end (index.html) doesn't need any changes.
//
// Set the environment variable GEMINI_API_KEY in your hosting dashboard
// (Vercel: Project -> Settings -> Environment Variables).
// Get a free key (no card needed) at https://aistudio.google.com/apikey

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { system, messages } = req.body;

    // Convert Anthropic-style messages ({role:'user'|'assistant', content:'...'})
    // into Gemini's format ({role:'user'|'model', parts:[{text}]}).
    const contents = (messages || []).map(m => ({
      role: m.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: m.content }]
    }));

    const geminiResponse = await fetch(
      'https://generativelanguage.googleapis.com/v1beta/models/gemini-3.1-flash-lite:generateContent',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-goog-api-key': process.env.GEMINI_API_KEY
        },
        body: JSON.stringify({
          system_instruction: { parts: [{ text: system }] },
          contents
        })
      }
    );

    const data = await geminiResponse.json();

    if (!geminiResponse.ok) {
      console.error('Gemini API error:', data);
      return res.status(geminiResponse.status).json({ error: data });
    }

    const replyText =
      data.candidates?.[0]?.content?.parts?.map(p => p.text).join('') ||
      "Sorry, I couldn't work that out — try asking in a different way.";

    // Reshape into the same shape the front-end already expects.
    return res.status(200).json({
      content: [{ type: 'text', text: replyText }]
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Server error reaching the tax assistant.' });
  }
}
