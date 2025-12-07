
import { Timestamp } from 'firebase/firestore';

export type Transaction = {
  id: string;
  userId: string;
  date: Date | Timestamp;
  description: string;
  amount: number;
  category: 'Income' | 'Expense' | 'Liability';
  subcategory: string;
  paymentMethod: string;
};

export type RecurringTransaction = {
  id: string;
  userId: string;
  description: string;
  amount: number;
  category: 'Income' | 'Expense' | 'Liability';
  subcategory: string;
  frequency: 'daily' | 'weekly' | 'monthly' | 'yearly';
  startDate: Date | Timestamp;
  endDate?: Date | Timestamp;
  paymentMethod: string;
};

export type FinancialGoal = {
  id: string;
  userId: string;
  name: string;
  targetAmount: number;
  currentAmount: number;
  deadline?: Date | Timestamp;
};

export type Debt = {
  id: string;
  userId: string;
  name: string;
  principalAmount: number;
  interestRate: number;
  minimumPayment: number;
  currentBalance: number;
  term?: number;
};

export type BudgetCategory = {
  name: string;
  budgeted: number;
  actual: number;
};

export type Budget = {
  id: string;
  userId: string;
  name: string;
  startDate: Date | Timestamp;
  endDate: Date | Timestamp;
  income: BudgetCategory[];
  expenses: BudgetCategory[];
};
