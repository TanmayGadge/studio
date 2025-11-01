import {genkit} from 'genkit';
import {googleAI} from '@genkit-ai/googleai';
import {gemini25Flash} from '@genkit-ai/googleai';

export const ai = genkit({
  plugins: [
    googleAI({
      // The Gemini API key is read from the GEMINI_API_KEY environment variable.
    }),
  ],
});
