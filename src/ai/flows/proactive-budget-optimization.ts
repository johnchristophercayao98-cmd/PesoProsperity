'use server';

/**
 * @fileOverview This file defines a Genkit flow for proactive budget optimization.
 *
 * The flow analyzes market conditions and spending patterns to suggest budget adjustments.
 * It exports the ProactiveBudgetOptimizationInput and ProactiveBudgetOptimizationOutput types,
 * and the proactiveBudgetOptimization function to trigger the flow.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const ProactiveBudgetOptimizationInputSchema = z.object({
  marketConditions: z.string().describe('Description of current market conditions.'),
  spendingPatterns: z.string().describe('Analysis of recent spending patterns.'),
  currentBudget: z.string().describe('The current budget in JSON format.'),
});
export type ProactiveBudgetOptimizationInput = z.infer<
  typeof ProactiveBudgetOptimizationInputSchema
>;

const ProactiveBudgetOptimizationOutputSchema = z.object({
  suggestedAdjustments: z.string().describe('Suggested budget adjustments based on AI analysis.'),
  rationale: z.string().describe('Rationale for the suggested adjustments.'),
});
export type ProactiveBudgetOptimizationOutput = z.infer<
  typeof ProactiveBudgetOptimizationOutputSchema
>;

export async function proactiveBudgetOptimization(
  input: ProactiveBudgetOptimizationInput
): Promise<ProactiveBudgetOptimizationOutput> {
  return proactiveBudgetOptimizationFlow(input);
}

const prompt = ai.definePrompt({
  name: 'proactiveBudgetOptimizationPrompt',
  input: {schema: ProactiveBudgetOptimizationInputSchema},
  output: {schema: ProactiveBudgetOptimizationOutputSchema},
  prompt: `You are an AI budget optimization assistant for small enterprises.

  Based on the provided market conditions, spending patterns, and current budget, suggest budget adjustments to optimize financial performance.
  Explain the rationale behind each suggested adjustment.

  Market Conditions: {{{marketConditions}}}
  Spending Patterns: {{{spendingPatterns}}}
  Current Budget: {{{currentBudget}}}

  Provide the suggested adjustments and rationale in a clear and concise manner.
  The suggested adjustments should be returned as JSON.
  `,
});

const proactiveBudgetOptimizationFlow = ai.defineFlow(
  {
    name: 'proactiveBudgetOptimizationFlow',
    inputSchema: ProactiveBudgetOptimizationInputSchema,
    outputSchema: ProactiveBudgetOptimizationOutputSchema,
  },
  async input => {
    const {output} = await prompt(input);
    return output!;
  }
);
