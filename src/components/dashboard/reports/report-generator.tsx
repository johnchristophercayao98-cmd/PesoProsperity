'use client';

import { useState } from 'react';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { DatePicker } from '@/components/ui/date-picker';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Download, Loader2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import {
  useFirestore,
  useUser,
} from '@/firebase';
import {
  collection,
  query,
  where,
  getDocs,
  Timestamp,
} from 'firebase/firestore';
import { format, addDays, addWeeks, addMonths, addYears, isAfter, isBefore, isEqual, isWithinInterval, startOfDay, startOfMonth, endOfMonth } from 'date-fns';
import type { Transaction, RecurringTransaction, Budget, BudgetCategory } from '@/lib/types';

const toDate = (date: any): Date | undefined => {
  if (!date) return undefined;
  if (date instanceof Date) return date;
  if (date instanceof Timestamp) return date.toDate();
  if (typeof date === 'string' || typeof date === 'number') {
    const parsedDate = new Date(date);
    if (!isNaN(parsedDate.getTime())) {
      return parsedDate;
    }
  }
  return undefined;
};

const generateTransactionInstances = (
  recurringTxs: RecurringTransaction[],
  periodStart: Date,
  periodEnd: Date,
): Transaction[] => {
  const instances: Transaction[] = [];

  recurringTxs.forEach((rt) => {
    const startDate = toDate(rt.startDate);
    if (!startDate) return;

    let currentDate = startDate;
    const endDate = toDate(rt.endDate);

    while (isBefore(currentDate, periodEnd) || isEqual(currentDate, periodEnd)) {
      if (endDate && isAfter(currentDate, endDate)) {
        break;
      }

      if (isWithinInterval(currentDate, { start: periodStart, end: periodEnd })) {
        instances.push({
          ...rt,
          id: `${rt.id}-${currentDate.toISOString()}`,
          date: currentDate,
          description: `${rt.description} (Recurring)`,
        });
      }
      
      if (isAfter(currentDate, periodEnd)) break;

      switch (rt.frequency) {
        case 'daily':
          currentDate = addDays(currentDate, 1);
          break;
        case 'weekly':
          currentDate = addWeeks(currentDate, 1);
          break;
        case 'monthly':
          currentDate = addMonths(currentDate, 1);
          break;
        case 'yearly':
          currentDate = addYears(currentDate, 1);
          break;
        default:
          return;
      }
    }
  });
  return instances;
};

export function ReportGenerator() {
  const [reportType, setReportType] = useState<string>();
  const [startDate, setStartDate] = useState<Date>();
  const [endDate, setEndDate] = useState<Date>();
  const [isGenerating, setIsGenerating] = useState(false);
  const { toast } = useToast();
  const firestore = useFirestore();
  const { user } = useUser();

  const handleExport = async () => {
    if (!reportType || !startDate || !endDate) {
      toast({
        variant: 'destructive',
        title: 'Incomplete Form',
        description: 'Please select a report type and date range.',
      });
      return;
    }

    if (!user) {
      toast({
        variant: 'destructive',
        title: 'Not Authenticated',
        description: 'You must be logged in to generate a report.',
      });
      return;
    }

    setIsGenerating(true);
    toast({
      title: 'Generating Report...',
      description: `Your ${reportType} report from ${startDate.toLocaleDateString()} to ${endDate.toLocaleDateString()} is being prepared.`,
    });

    try {
      // Common data fetching
      const singleTransactionsQuery = query(
        collection(firestore, 'users', user.uid, 'expenses'),
        where('date', '>=', startDate),
        where('date', '<=', endDate)
      );
      const recurringTransactionsQuery = query(collection(firestore, 'users', user.uid, 'recurringTransactions'));

      const singleSnapshot = await getDocs(singleTransactionsQuery);
      const singleTransactions = singleSnapshot.docs.map(
        (doc) => ({ ...doc.data(), id: doc.id } as Transaction)
      );
      
      const recurringSnapshot = await getDocs(recurringTransactionsQuery);
      const recurringTransactions = recurringSnapshot.docs.map(
        (doc) => ({...doc.data(), id: doc.id } as RecurringTransaction)
      );

      const recurringInstances = generateTransactionInstances(recurringTransactions, startDate, endDate);
      const allTransactions = [...singleTransactions, ...recurringInstances];


      if (allTransactions.length === 0 && reportType !== 'budget-variance') {
        toast({
            variant: 'destructive',
            title: 'No Data Found',
            description: 'There are no transactions in the selected date range.',
        });
        setIsGenerating(false);
        return;
      }
      
      allTransactions.sort((a,b) => toDate(a.date)!.getTime() - toDate(b.date)!.getTime());

      let csvContent = '';
      if (reportType === 'income-vs-expense') {
        let totalIncome = 0;
        let totalExpense = 0;
        
        const dataRows = allTransactions.map(t => {
            const date = toDate(t.date);
            if (t.category === 'Income') {
                totalIncome += t.amount;
                return [
                    date ? format(date, 'd-MMM-yyyy') : '',
                    t.paymentMethod,
                    `"${t.description.replace(/"/g, '""')}"`,
                    t.subcategory,
                    t.amount.toFixed(2),
                    ''
                ].join(',');
            } else {
                totalExpense += t.amount;
                return [
                    date ? format(date, 'd-MMM-yyyy') : '',
                    t.paymentMethod,
                    `"${t.description.replace(/"/g, '""')}"`,
                    t.subcategory,
                    '',
                    t.amount.toFixed(2)
                ].join(',');
            }
        }).join('\n');

        csvContent += 'Income vs Expense\n\n';
        csvContent += `Total Income:,${totalIncome.toFixed(2)}\n`;
        csvContent += `Total Expense:,${totalExpense.toFixed(2)}\n\n`;
        csvContent += 'Date,Account,Description,Category,Income,Expense\n';
        csvContent += dataRows;

      } else if (reportType === 'budget-variance') {
        const monthStartForBudget = startOfMonth(startDate);
        const monthEndForBudget = endOfMonth(startDate);
        
        const budgetsQuery = query(
            collection(firestore, 'users', user.uid, 'budgets'),
            where('startDate', '>=', monthStartForBudget),
            where('startDate', '<=', monthEndForBudget)
        );
        const budgetSnapshot = await getDocs(budgetsQuery);
        if (budgetSnapshot.empty) {
            toast({ variant: 'destructive', title: 'No Budget Found', description: `No budget set for ${format(startDate, 'MMMM yyyy')}.`});
            setIsGenerating(false);
            return;
        }
        const budget = budgetSnapshot.docs[0].data() as Budget;

        // Transactions for the budget month
        const monthlyTransactions = allTransactions.filter(t => {
            const tDate = toDate(t.date);
            return tDate && isWithinInterval(tDate, { start: monthStartForBudget, end: monthEndForBudget });
        });

        const getCategoryData = (name: string, type: 'income' | 'expense') => {
          const budgetedCategory = budget[type]?.find(c => c.name === name);
          const budgeted = budgetedCategory?.budgeted || 0;
          const actual = monthlyTransactions
              .filter(t => t.category === (type === 'income' ? 'Income' : 'Expense') && t.subcategory === name)
              .reduce((sum, t) => sum + t.amount, 0);
          const variance = type === 'income' ? actual - budgeted : budgeted - actual;
          const percentage = budgeted !== 0 ? (variance / budgeted) * 100 : 0;
          return { name, budgeted, actual, variance, percentage };
        };

        const formatCurrency = (value: number) => `"$${value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}"`;
        const formatPercent = (value: number) => `"${value.toFixed(2)}%"`;

        const row = (title: string, data: { budgeted: number, actual: number, variance: number, percentage: number }, bold = false) => {
          const titleStr = bold ? `"${title}"` : `  ${title}`;
          return [
            titleStr,
            formatCurrency(data.budgeted),
            formatCurrency(data.actual),
            formatCurrency(data.variance),
            formatPercent(data.percentage)
          ].join(',');
        };
        
        const summaryRow = (title: string, data: { budgeted: number, actual: number, variance: number, percentage: number }) => row(title, data, true);

        csvContent = 'Budget vs Actual Variance\n';
        csvContent += `For ${format(startDate, 'MMMM yyyy')}\n\n`;
        csvContent += 'Title,Budget,Actual,Budget Variance,Percentage Variance\n';

        const grossSalesData = { budgeted: 0, actual: 0, variance: 0, percentage: 0 };
        (budget.income || []).forEach(cat => {
            const data = getCategoryData(cat.name, 'income');
            grossSalesData.budgeted += data.budgeted;
            grossSalesData.actual += data.actual;
        });
        grossSalesData.variance = grossSalesData.actual - grossSalesData.budgeted;
        grossSalesData.percentage = grossSalesData.budgeted ? (grossSalesData.variance / grossSalesData.budgeted) * 100 : 0;
        
        csvContent += summaryRow('Gross Sales', grossSalesData) + '\n';
        csvContent += 'Less: Discounts,"$ -","$ -","$ -",\n'; // Placeholder
        csvContent += summaryRow('Net Sales', grossSalesData) + '\n';
        
        const cogsCats = ['Cost of Goods Sold', 'Raw Material Cost', 'Manufacturing Cost', 'Labor Cost'];
        const cogsData = cogsCats.map(cat => getCategoryData(cat, 'expense'));
        
        const totalCogs = cogsData.reduce((acc, data) => {
          acc.budgeted += data.budgeted;
          acc.actual += data.actual;
          return acc;
        }, { budgeted: 0, actual: 0, variance: 0, percentage: 0 });
        totalCogs.variance = totalCogs.budgeted - totalCogs.actual;
        totalCogs.percentage = totalCogs.budgeted ? (totalCogs.variance / totalCogs.budgeted) * 100 : 0;

        csvContent += summaryRow('Less: Cost of Goods Sold', totalCogs) + '\n';
        cogsData.filter(d => d.budgeted > 0 || d.actual > 0).forEach(d => {
            csvContent += row(d.name, d) + '\n';
        });

        const grossProfit = {
          budgeted: grossSalesData.budgeted - totalCogs.budgeted,
          actual: grossSalesData.actual - totalCogs.actual,
          variance: (grossSalesData.actual - totalCogs.actual) - (grossSalesData.budgeted - totalCogs.budgeted),
          percentage: 0
        };
        grossProfit.percentage = grossProfit.budgeted ? (grossProfit.variance / grossProfit.budgeted) * 100 : 0;
        csvContent += summaryRow('Gross Profit', grossProfit) + '\n';
        
        const overheadCats = ['Salaries and Wages', 'Rent', 'Utilities', 'Marketing and Advertising', 'Office Supplies', 'Software and Subscriptions', 'Taxes', 'Travel', 'Repairs and Maintenance', 'Other'];
        const overheadsData = overheadCats.map(cat => getCategoryData(cat, 'expense'));

        const totalOverheads = overheadsData.reduce((acc, data) => {
          acc.budgeted += data.budgeted;
          acc.actual += data.actual;
          return acc;
        }, { budgeted: 0, actual: 0, variance: 0, percentage: 0 });
        totalOverheads.variance = totalOverheads.budgeted - totalOverheads.actual;
        totalOverheads.percentage = totalOverheads.budgeted ? (totalOverheads.variance / totalOverheads.budgeted) * 100 : 0;

        csvContent += summaryRow('Less: Overheads', totalOverheads) + '\n';
        overheadsData.filter(d => d.budgeted > 0 || d.actual > 0).forEach(d => {
            if (d.name === 'Salaries and Wages') {
                csvContent += row('Administrative Overheads', d) + '\n';
            } else if (d.name === 'Marketing and Advertising') {
                csvContent += row('Selling and Distribution Overheads', d) + '\n';
            } else {
                 csvContent += row(d.name, d) + '\n';
            }
        });
        
        const netProfit = {
            budgeted: grossProfit.budgeted - totalOverheads.budgeted,
            actual: grossProfit.actual - totalOverheads.actual,
            variance: (grossProfit.actual - totalOverheads.actual) - (grossProfit.budgeted - totalOverheads.budgeted),
            percentage: 0
        };
        netProfit.percentage = netProfit.budgeted ? (netProfit.variance / netProfit.budgeted) * 100 : 0;
        csvContent += summaryRow('Net Profit', netProfit) + '\n';


      } else {
        // Fallback for other report types
        const headers = 'Date,Description,Category,Subcategory,Amount,PaymentMethod\n';
        const rows = allTransactions
          .map((t) => {
            const date = toDate(t.date);
            return [
              date ? format(date, 'yyyy-MM-dd') : '',
              `"${t.description.replace(/"/g, '""')}"`,
              t.category,
              t.subcategory,
              t.amount,
              t.paymentMethod,
            ].join(',');
          })
          .join('\n');
        csvContent = headers + rows;
      }

      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement('a');
      if (link.download !== undefined) {
        const url = URL.createObjectURL(blob);
        link.setAttribute('href', url);
        link.setAttribute(
          'download',
          `report-${reportType}-${Date.now()}.csv`
        );
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
      }

      toast({
        title: 'Report Exported!',
        description: 'Your report has been downloaded.',
      });
    } catch (error) {
      console.error('Error generating report:', error);
      toast({
        variant: 'destructive',
        title: 'Error Generating Report',
        description:
          'An unexpected error occurred. Please check the console and try again.',
      });
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <Card className="max-w-2xl mx-auto">
      <CardHeader>
        <CardTitle>Generate a Report</CardTitle>
        <CardDescription>
          Select the type of report and the date range you want to cover.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="space-y-2">
          <Label htmlFor="report-type">Report Type</Label>
          <Select onValueChange={setReportType} value={reportType}>
            <SelectTrigger id="report-type">
              <SelectValue placeholder="Select a report type" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="income-vs-expense">
                Income vs. Expense
              </SelectItem>
              <SelectItem value="budget-variance">
                Budget vs Actual Variance
              </SelectItem>
              <SelectItem value="debt-payoff">Debt Payoff Progress</SelectItem>
              <SelectItem value="cash-flow-statement">
                Cash Flow Statement
              </SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>Start Date</Label>
            <DatePicker date={startDate} setDate={setStartDate} />
          </div>
          <div className="space-y-2">
            <Label>End Date</Label>
            <DatePicker date={endDate} setDate={setEndDate} />
          </div>
        </div>
        <Button className="w-full" onClick={handleExport} disabled={isGenerating}>
          {isGenerating ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <Download className="mr-2 h-4 w-4" />
          )}
          Generate & Export CSV
        </Button>
      </CardContent>
    </Card>
  );
}
