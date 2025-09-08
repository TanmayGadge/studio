'use server';
/**
 * @fileOverview A GenAI tool to classify objects for lane detection calculations.
 *
 * - classifyLaneDepartureObjects - A function that classifies objects as relevant or irrelevant for lane departure detection.
 * - ClassifyLaneDepartureObjectsInput - The input type for the classifyLaneDepartureObjects function.
 * - ClassifyLaneDepartureObjectsOutput - The return type for the classifyLaneDepartureObjects function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const ClassifyLaneDepartureObjectsInputSchema = z.object({
  objectDescription: z
    .string()
    .describe('A description of the object detected by the system.'),
  imageUri: z
    .string()
    .describe(
      "A photo of the surrounding objects, as a data URI that must include a MIME type and use Base64 encoding. Expected format: 'data:<mimetype>;base64,<encoded_data>'."
    ),
});
export type ClassifyLaneDepartureObjectsInput = z.infer<
  typeof ClassifyLaneDepartureObjectsInputSchema
>;

const ClassifyLaneDepartureObjectsOutputSchema = z.object({
  isRelevant: z
    .boolean()
    .describe(
      'Whether the object is relevant for lane departure calculations.'
    ),
  reason: z
    .string()
    .describe(
      'The reasoning behind the classification, explaining why the object is relevant or not.'
    ),
});
export type ClassifyLaneDepartureObjectsOutput = z.infer<
  typeof ClassifyLaneDepartureObjectsOutputSchema
>;

export async function classifyLaneDepartureObjects(
  input: ClassifyLaneDepartureObjectsInput
): Promise<ClassifyLaneDepartureObjectsOutput> {
  return classifyLaneDepartureObjectsFlow(input);
}

const classifyLaneDepartureObjectsPrompt = ai.definePrompt({
  name: 'classifyLaneDepartureObjectsPrompt',
  input: {schema: ClassifyLaneDepartureObjectsInputSchema},
  output: {schema: ClassifyLaneDepartureObjectsOutputSchema},
  prompt: `You are an expert in computer vision and autonomous driving systems.

You are tasked with classifying objects detected by a vehicle's camera system to determine if they are relevant for lane departure detection calculations.

Consider factors such as the object's position relative to the lane, its size, and its potential impact on the vehicle's trajectory.

Object Description: {{{objectDescription}}}
Image: {{media url=imageUri}}

Based on the provided description and image, determine if the object is relevant for lane departure calculations. Explain your reasoning.
`,
});

const classifyLaneDepartureObjectsFlow = ai.defineFlow(
  {
    name: 'classifyLaneDepartureObjectsFlow',
    inputSchema: ClassifyLaneDepartureObjectsInputSchema,
    outputSchema: ClassifyLaneDepartureObjectsOutputSchema,
  },
  async input => {
    const {output} = await classifyLaneDepartureObjectsPrompt(input);
    return output!;
  }
);
