'use server';
/**
 * @fileOverview A GenAI flow to analyze video frames for lane and object detection.
 *
 * - analyzeVideo - A function that analyzes a video frame to detect lanes and objects.
 * - AnalyzeVideoInput - The input type for the analyzeVideo function.
 * - AnalyzeVideoOutput - The return type for the analyzeVideo function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const AnalyzeVideoInputSchema = z.object({
  frameDataUri: z
    .string()
    .describe(
      "A single frame from a video, as a data URI that must include a MIME type and use Base64 encoding. Expected format: 'data:<mimetype>;base64,<encoded_data>'."
    ),
});
export type AnalyzeVideoInput = z.infer<typeof AnalyzeVideoInputSchema>;

const AnalyzeVideoOutputSchema = z.object({
  lanes: z.array(z.object({
    startX: z.number().describe('The starting X coordinate of the lane line.'),
    startY: z.number().describe('The starting Y coordinate of the lane line.'),
    endX: z.number().describe('The ending X coordinate of the lane line.'),
    endY: z.number().describe('The ending Y coordinate of the lane line.'),
  })).describe('An array of detected lane lines.'),
  objects: z.array(z.object({
    label: z.string().describe('The label of the detected object (e.g., car, pedestrian).'),
    x: z.number().describe('The X coordinate of the top-left corner of the bounding box.'),
    y: z.number().describe('The Y coordinate of the top-left corner of the bounding box.'),
    width: z.number().describe('The width of the bounding box.'),
    height: z.number().describe('The height of the bounding box.'),
  })).describe('An array of detected objects with their bounding boxes.'),
});
export type AnalyzeVideoOutput = z.infer<typeof AnalyzeVideoOutputSchema>;

export async function analyzeVideo(
  input: AnalyzeVideoInput
): Promise<AnalyzeVideoOutput> {
  return videoAnalysisFlow(input);
}

const videoAnalysisPrompt = ai.definePrompt({
  name: 'videoAnalysisPrompt',
  input: {schema: AnalyzeVideoInputSchema},
  output: {schema: AnalyzeVideoOutputSchema},
  prompt: `You are an expert computer vision model for autonomous driving.

You will be given a frame from a vehicle's camera feed. Your task is to identify lane markings on the road and detect any relevant objects such as other vehicles, pedestrians, or obstacles.

Provide the coordinates for the detected lane lines and bounding boxes for any detected objects.

Frame: {{media url=frameDataUri}}

Analyze the provided frame and return the detected lanes and objects.
`,
});

const videoAnalysisFlow = ai.defineFlow(
  {
    name: 'videoAnalysisFlow',
    inputSchema: AnalyzeVideoInputSchema,
    outputSchema: AnalyzeVideoOutputSchema,
  },
  async input => {
    const {output} = await videoAnalysisPrompt(input);
    return output!;
  }
);
