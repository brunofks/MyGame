const OpenAI = require('openai');

const openai = new OpenAI({
    apiKey: process.env.OPENAI_KEY
});

async function generateAnswer(question) {
    const response = await openai.chat.completions.create({
        model: "gpt-3.5-turbo",
        messages: [{
            role: "user",
            content: `Responda de forma convincente como humano: ${question}`
        }]
    });
    
    return response.choices[0].message.content;
}

module.exports = { generateAnswer }; 