const express = require('express');
const router = express.Router();

router.post('/:id/ai/chat', async (req, res) => {
  try {
    const { prompt, fileContext } = req.body;
    const llmApiKey = process.env.LLM_API_KEY;

    if (!llmApiKey) {
      const simulatedResponse = `Simulated AI Response. I received your prompt: "${prompt}". Here is the snippet I analyzed from your editor:\n\n${fileContext.substring(0, 100)}...`;
      return res.status(200).json({ response: simulatedResponse });
    }

    const actualResponse = `Actual AI Response for: ${prompt}`;
    res.status(200).json({ response: actualResponse });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
