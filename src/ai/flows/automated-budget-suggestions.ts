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

const SuggestMonthlyBudgetOutputSchema = z.object({
  suggestedBudget: z
    .string()
    .describe('The suggested monthly budget in JSON format, including income, expenses, and savings categories.'),
  explanation: z
    .string()
    .describe('A brief explanation of how the budget was generated and any assumptions made.'),
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
  Analyze the provided financial data and generate a suggested monthly budget in JSON format. Include categories for income, expenses, and savings.
  If financial data is not usable return a JSON object with \"error\" set to true, and the \"suggestedBudget\" field set to null.

  Financial Data:
  {{financialData}}

  Ensure the suggested budget is realistic, beginner-friendly, and easy to navigate for users with limited financial literacy.
  Provide a brief explanation of how the budget was generated and any assumptions made.
  Example of expected output:
  {
    "income": {
      "salary": 50000,
      "other": 5000
    },
    "expenses": {
      "rent": 15000,
      "utilities": 5000,
      "food": 10000,
      "transportation": 3000,
      "other": 2000
    },
    "savings": {
      "emergencyFund": 5000,
      "goalSavings": 5000
    }
  }
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
