'use server';
/**
 * @fileOverview An object detection AI agent that learns to ignore non-threatening entities.
 *
 * - objectDetectionIgnore - A function that handles the object detection and filtering process.
 * - ObjectDetectionIgnoreInput - The input type for the objectDetectionIgnore function.
 * - ObjectDetectionIgnoreOutput - The return type for the objectDetectionIgnore function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const ObjectDetectionIgnoreInputSchema = z.object({
  detectedObjects: z
    .string()
    .describe('A comma-separated list of detected objects from the camera feed.'),
  distanceReadings: z
    .string()
    .describe('Distance readings from the ultrasonic sensor.'),
});
export type ObjectDetectionIgnoreInput = z.infer<typeof ObjectDetectionIgnoreInputSchema>;

const ObjectDetectionIgnoreOutputSchema = z.object({
  filteredObjects: z
    .string()
    .describe('A comma-separated list of filtered objects, excluding non-threatening entities.'),
  alertStatus: z
    .string()
    .describe('A status indicating whether an alert should be triggered based on the filtered objects and distance.'),
});
export type ObjectDetectionIgnoreOutput = z.infer<typeof ObjectDetectionIgnoreOutputSchema>;

const nonThreateningEntitiesTool = ai.defineTool({
  name: 'nonThreateningEntitiesTool',
  description: 'Identifies and filters out non-threatening entities from a list of detected objects based on context and distance readings.',
  inputSchema: z.object({
    detectedObjects: z
      .string()
      .describe('A comma-separated list of detected objects.'),
    distanceReadings: z
      .string()
      .describe('Distance readings from the ultrasonic sensor.'),
  }),
  outputSchema: z.object({
    filteredObjects: z
      .string()
      .describe('A comma-separated list of filtered objects, excluding non-threatening entities.'),
  }),
  async (input) => {
    // Placeholder implementation: replace with actual filtering logic
    const filteredObjects = input.detectedObjects
      .split(',')
      .filter(obj => !obj.toLowerCase().includes('sign')) // Example filter: remove objects containing "sign"
      .join(',');
    return {filteredObjects};
  },
});

const objectDetectionIgnorePrompt = ai.definePrompt({
  name: 'objectDetectionIgnorePrompt',
  tools: [nonThreateningEntitiesTool],
  input: {schema: ObjectDetectionIgnoreInputSchema},
  output: {schema: ObjectDetectionIgnoreOutputSchema},
  prompt: `You are an AI assistant that filters detected objects to identify potential hazards.

The detected objects from the camera are: {{{detectedObjects}}}.
The distance readings from the ultrasonic sensor are: {{{distanceReadings}}}.

Use the nonThreateningEntitiesTool to filter out any non-threatening entities like roadside signs or distant objects.

Based on the remaining objects and distance readings, determine if an alert should be triggered.

Output the filtered objects as a comma-separated list and provide an alert status (e.g., "ALERT", "SAFE").`,
});


const objectDetectionIgnoreFlow = ai.defineFlow(
  {
    name: 'objectDetectionIgnoreFlow',
    inputSchema: ObjectDetectionIgnoreInputSchema,
    outputSchema: ObjectDetectionIgnoreOutputSchema,
  },
  async input => {
    const {output} = await objectDetectionIgnorePrompt(input);
    return output!;
  }
);

export async function objectDetectionIgnore(input: ObjectDetectionIgnoreInput): Promise<ObjectDetectionIgnoreOutput> {
  return objectDetectionIgnoreFlow(input);
}

export type {nonThreateningEntitiesTool};

