import { Timestamp } from 'firebase/firestore';

export type Transaction = {
  id: string;
  userId: string;
  date: Date | Timestamp;
  description: string;
  amount: number;
  category: 'Income' | 'Expense';
  subcategory: string;
};

export type RecurringTransaction = {
  id: string;
  userId: string;
  description: string;
  amount: number;
  category: 'Income' | 'Expense';
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
  creditor: string;
  totalAmount: number;
  amountPaid: number;
  interestRate: number;
  nextPaymentDue: Date | Timestamp;
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
