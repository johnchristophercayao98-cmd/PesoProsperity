import type { FinancialGoal, Transaction, Debt, RecurringTransaction, Budget } from './types';

export const mainStats = [
  {
    title: 'Net Revenue',
    value: '₱45,231.89',
    change: '+20.1% from last month',
  },
  {
    title: 'Total Expenses',
    value: '₱23,150.00',
    change: '+12.2% from last month',
  },
  {
    title: 'Profit Margin',
    value: '48.8%',
    change: '+2.1% from last month',
  },
  {
    title: 'Cash Reserve',
    value: '₱120,780.00',
    change: 'Sufficient for 3 months',
  },
];

export const recentTransactions: Transaction[] = [
  {
    id: '1',
    date: new Date(),
    description: 'Product Sale',
    amount: 1999.0,
    category: 'Income',
    subcategory: 'Sales',
  },
  {
    id: '2',
    date: new Date(new Date().setDate(new Date().getDate() - 1)),
    description: 'Office Supplies',
    amount: 250.0,
    category: 'Expense',
    subcategory: 'Office',
  },
  {
    id: '3',
    date: new Date(new Date().setDate(new Date().getDate() - 1)),
    description: 'Client Payment',
    amount: 5000.0,
    category: 'Income',
    subcategory: 'Services',
  },
  {
    id: '4',
    date: new Date(new Date().setDate(new Date().getDate() - 2)),
    description: 'Internet Bill',
    amount: 1500.0,
    category: 'Expense',
    subcategory: 'Utilities',
  },
  {
    id: '5',
    date: new Date(new Date().setDate(new Date().getDate() - 3)),
    description: 'Software Subscription',
    amount: 499.0,
    category: 'Expense',
    subcategory: 'Software',
  },
];

export const financialGoals: FinancialGoal[] = [
    {
        id: '1',
        name: 'New Equipment Fund',
        targetAmount: 150000,
        currentAmount: 75000,
        deadline: new Date('2024-12-31'),
    },
    {
        id: '2',
        name: 'Emergency Fund',
        targetAmount: 100000,
        currentAmount: 95000,
    },
    {
        id: '3',
        name: 'Office Renovation',
        targetAmount: 250000,
        currentAmount: 50000,
        deadline: new Date('2025-06-30'),
    }
];

export const debts: Debt[] = [
    {
        id: '1',
        creditor: 'BDO Unibank',
        totalAmount: 500000,
        amountPaid: 125000,
        interestRate: 1.2,
        nextPaymentDue: new Date(new Date().setMonth(new Date().getMonth() + 1)),
    },
    {
        id: '2',
        creditor: 'Metrobank',
        totalAmount: 250000,
        amountPaid: 200000,
        interestRate: 0.9,
        nextPaymentDue: new Date(new Date().setMonth(new Date().getMonth() + 1)),
    },
    {
        id: '3',
        creditor: 'Supplier Credit',
        totalAmount: 75000,
        amountPaid: 75000,
        interestRate: 0,
        nextPaymentDue: new Date(),
    }
];


export const recurringTransactions: RecurringTransaction[] = [
    {
        id: '1',
        description: 'Office Rent',
        amount: 25000,
        category: 'Expense',
        frequency: 'monthly',
        startDate: new Date('2023-01-01'),
        paymentMethod: 'Bank Transfer'
    },
    {
        id: '2',
        description: 'Salaries',
        amount: 150000,
        category: 'Expense',
        frequency: 'monthly',
        startDate: new Date('2023-01-15'),
        paymentMethod: 'Payroll'
    },
    {
        id: '3',
        description: 'SaaS Subscription',
        amount: 5000,
        category: 'Expense',
        frequency: 'monthly',
        startDate: new Date('2023-01-20'),
        paymentMethod: 'Credit Card'
    },
    {
        id: '4',
        description: 'Retainer Client X',
        amount: 30000,
        category: 'Income',
        frequency: 'monthly',
        startDate: new Date('2023-02-01'),
        paymentMethod: 'Bank Transfer'
    }
];

export const sampleBudget: Budget = {
    month: 'July 2024',
    income: [
        { name: 'Product Sales', budgeted: 200000, actual: 215000 },
        { name: 'Service Fees', budgeted: 50000, actual: 45000 },
    ],
    expenses: [
        { name: 'Salaries', budgeted: 120000, actual: 120000 },
        { name: 'Rent', budgeted: 30000, actual: 30000 },
        { name: 'Utilities', budgeted: 15000, actual: 16500 },
        { name: 'Marketing', budgeted: 20000, actual: 18000 },
        { name: 'Supplies', budgeted: 10000, actual: 12000 },
        { name: 'Other', budgeted: 5000, actual: 3000 },
    ],
};
