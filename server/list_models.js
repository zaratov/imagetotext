require('dotenv').config();
const { OpenAI } = require('openai');

if (!process.env.OPENAI_API_KEY) {
  console.error('OPENAI_API_KEY not set in .env');
  process.exit(1);
}

const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

(async () => {
  try {
    const res = await client.models.list();
    console.log('Total models:', res.data.length);
    res.data.forEach(m => {
      console.log(m.id);
    });
  } catch (err) {
    console.error('Error listing models:', err);
    try { console.error(err.response?.status, err.response?.data || err.response?.body); } catch(e){}
    process.exit(2);
  }
})();
