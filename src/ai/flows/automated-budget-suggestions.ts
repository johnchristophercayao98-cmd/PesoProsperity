'use server';

/**
 * @fileOverview AI-powered monthly budget suggestion flow.
 *
 * - suggestMonthlyBudget - A function that suggests a monthly budget based on user's financial data.
 * - SuggestMonthlyBudgetInput - The input type for the suggestMonthlyBudget function.
 * - SuggestMonthlyBudgetOutput - The return type for the suggestMonthlyBudget function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const SuggestMonthlyBudgetInputSchema = z.object({
  financialData: z
    .string()
    .describe(
      'The user financial data in spreadsheet format (e.g. CSV), containing income and expenses information.'
    ),
});
export type SuggestMonthlyBudgetInput = z.infer<typeof SuggestMonthlyBudgetInputSchema>;

const BudgetItemSchema = z.object({
  category: z.string().describe('The name of the budget category (e.g., "Sales", "Rent").'),
  amount: z.number().describe('The suggested budget amount for this category.'),
  recommendation: z.string().describe('A brief recommendation or insight for this specific budget item.'),
});

const SuggestMonthlyBudgetOutputSchema = z.object({
  income: z.array(BudgetItemSchema).describe('A list of suggested income categories and amounts.'),
  expenses: z.array(BudgetItemSchema).describe('A list of suggested expense categories and amounts.'),
  savings: z.array(BudgetItemSchema).describe('A list of suggested savings categories and amounts.'),
  summary: z
    .string()
    .describe('A brief, high-level summary and explanation of how the budget was generated and any assumptions made.'),
});
export type SuggestMonthlyBudgetOutput = z.infer<typeof SuggestMonthlyBudgetOutputSchema>;

export async function suggestMonthlyBudget(
  input: SuggestMonthlyBudgetInput
): Promise<SuggestMonthlyBudgetOutput> {
  return suggestMonthlyBudgetFlow(input);
}

const prompt = ai.definePrompt({
  name: 'suggestMonthlyBudgetPrompt',
  input: {schema: SuggestMonthlyBudgetInputSchema},
  output: {schema: SuggestMonthlyBudgetOutputSchema},
  prompt: `You are a financial advisor specializing in creating monthly budgets for small enterprises in the Philippines.
  Analyze the provided financial data and generate a suggested monthly budget. Your output must be a valid JSON object matching the provided schema.

  For each item in the income, expenses, and savings arrays, you must provide a 'category', a suggested 'amount', and a concise 'recommendation'. The recommendation should be a helpful tip or observation related to that specific budget item.

  Also provide a high-level 'summary' that explains the overall budget and any assumptions you made.

  Financial Data:
  {{{financialData}}}

  Ensure the suggested budget is realistic, beginner-friendly, and easy to navigate for users with limited financial literacy.
  If the financial data is not usable or understandable, return a JSON object with empty arrays for income, expenses, and savings, and a summary explaining that the data could not be processed.
  `,
});

const suggestMonthlyBudgetFlow = ai.defineFlow(
  {
    name: 'suggestMonthlyBudgetFlow',
    inputSchema: SuggestMonthlyBudgetInputSchema,
    outputSchema: SuggestMonthlyBudgetOutputSchema,
  },
  async input => {
    const {output} = await prompt(input);
    return output!;
  }
);
