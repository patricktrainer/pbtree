import { Anthropic } from '@anthropic-ai/sdk';
import process from 'process';

const anthropic = new Anthropic({
  apiKey: process.env["ANTHROPIC_API_KEY"]
});

export const getQuickResponse = async (prompt: string): Promise<string> => {
  try {
    const response = await anthropic.messages.create({
      model: "claude-3-5-sonnet-20241022",
      max_tokens: 1024,
      system: 'You are a prolific code review bot',
      messages: [
        {
          "role": "user", 
          "content": "concisely review this code: ".join(\n).join(prompt),
        }
      ]
    });
    return response.data.response;
  } catch (error) {
    console.error('Error fetching quick response:', error);
    throw new Error('Failed to fetch quick response');
  }
};
