
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
import { format, addDays, addWeeks, addMonths, addYears, isAfter, isBefore, isEqual, isWithinInterval, startOfDay, startOfMonth, endOfMonth, eachMonthOfInterval } from 'date-fns';
import type { Transaction, RecurringTransaction, Budget, Debt } from '@/lib/types';

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
  const today = startOfDay(new Date());

  recurringTxs.forEach((rt) => {
    const startDate = toDate(rt.startDate);
    if (!startDate) return;

    let currentDate = startDate;
    const endDate = toDate(rt.endDate);
    
    const generationEndDate = isBefore(periodEnd, today) ? periodEnd : today;

    while (isBefore(currentDate, generationEndDate) || isEqual(currentDate, generationEndDate)) {
      if (endDate && isAfter(currentDate, endDate)) {
        break;
      }

      if (isWithinInterval(currentDate, { start: periodStart, end: generationEndDate })) {
        instances.push({
          ...rt,
          id: `${rt.id}-${currentDate.toISOString()}`,
          date: currentDate,
          description: `${rt.description} (Recurring)`,
        });
      }
      
      if (isAfter(currentDate, generationEndDate)) break;

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

const formatCurrencyForCSV = (value: number) => `"₱${value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}"`;

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
        collection(firestore, 'users', user.uid, 'expenses')
      );
      const recurringTransactionsQuery = query(collection(firestore, 'users', user.uid, 'recurringTransactions'));
      const debtsQuery = query(collection(firestore, 'users', user.uid, 'debts'));


      const [singleSnapshot, recurringSnapshot, debtsSnapshot] = await Promise.all([
        getDocs(singleTransactionsQuery),
        getDocs(recurringTransactionsQuery),
        getDocs(debtsQuery),
      ]);
      
      const singleTransactions = singleSnapshot.docs.map(
        (doc) => ({ ...doc.data(), id: doc.id } as Transaction)
      );
      
      const recurringTransactions = recurringSnapshot.docs.map(
        (doc) => ({...doc.data(), id: doc.id } as RecurringTransaction)
      );
      
      const debts = debtsSnapshot.docs.map(
        (doc) => ({...doc.data(), id: doc.id } as Debt)
      );

      const allRecurringInstances = generateTransactionInstances(recurringTransactions, new Date(0), endDate);
      const allTransactions = [...singleTransactions, ...allRecurringInstances];


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
        const transactionsInRange = allTransactions.filter(t => {
            const tDate = toDate(t.date);
            return tDate && isWithinInterval(tDate, { start: startDate, end: endDate });
        });

        if (transactionsInRange.length === 0) {
            toast({ variant: 'destructive', title: 'No Data', description: 'No transactions found in the selected range.' });
            setIsGenerating(false);
            return;
        }

        let totalIncome = 0;
        let totalExpense = 0;
        
        const dataRows = transactionsInRange.map(t => {
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

        const monthlyTransactions = allTransactions.filter(t => {
            const tDate = toDate(t.date);
            return tDate && isWithinInterval(tDate, { start: monthStartForBudget, end: monthEndForBudget });
        });
        
        const incomeCategories = budget.income?.map(c => c.name) || [];
        const expenseCategories = budget.expenses?.map(c => c.name) || [];
        const allCategories = [...new Set([...incomeCategories, ...expenseCategories])];

        const getCategoryData = (name: string) => {
          const budgetedIncome = budget.income?.find(c => c.name === name)?.budgeted || 0;
          const budgetedExpense = budget.expenses?.find(c => c.name === name)?.budgeted || 0;
          const budgeted = budgetedIncome > 0 ? budgetedIncome : budgetedExpense;

          const actual = monthlyTransactions
              .filter(t => t.subcategory === name)
              .reduce((sum, t) => sum + t.amount, 0);

          const isIncome = budgetedIncome > 0;
          const variance = isIncome ? actual - budgeted : budgeted - actual;
          const percentage = budgeted !== 0 ? (variance / budgeted) * 100 : (actual > 0 ? 100 : 0);
          return { name, budgeted, actual, variance, percentage, isIncome };
        };

        const formatPercent = (value: number) => `"${value.toFixed(2)}%"`;
        const row = (title: string, data: { budgeted: number, actual: number, variance: number, percentage: number }, bold = false) => {
          const titleStr = bold ? `"${title}"` : `  ${title}`;
          return [
            titleStr,
            formatCurrencyForCSV(data.budgeted),
            formatCurrencyForCSV(data.actual),
            formatCurrencyForCSV(data.variance),
            formatPercent(data.percentage)
          ].join(',');
        };
        
        const summaryRow = (title: string, data: { budgeted: number, actual: number, variance: number, percentage: number }) => row(title, data, true);

        csvContent = 'Budget vs Actual Variance\n';
        csvContent += `For ${format(startDate, 'MMMM yyyy')}\n\n`;
        csvContent += 'Title,Budget,Actual,Budget Variance,Percentage Variance\n';
        
        const allData = allCategories.map(getCategoryData);

        const allIncomeData = allData.filter(d => d.isIncome);
        const totalIncome = allIncomeData.reduce((acc, data) => {
            acc.budgeted += data.budgeted;
            acc.actual += data.actual;
            return acc;
        }, { budgeted: 0, actual: 0, variance: 0, percentage: 0 });
        totalIncome.variance = totalIncome.actual - totalIncome.budgeted;
        totalIncome.percentage = totalIncome.budgeted ? (totalIncome.variance / totalIncome.budgeted) * 100 : (totalIncome.actual > 0 ? 100 : 0);
        
        csvContent += summaryRow('Gross Sales', totalIncome) + '\n';
        // You could add a discounts row if you track them
        csvContent += '"Less: Discounts",,"-",,"-",\n';
        csvContent += summaryRow('Net Sales', totalIncome) + '\n';
        
        const cogsCats = ['Cost of Goods Sold'];
        const cogsData = allData.filter(d => cogsCats.includes(d.name) && !d.isIncome);
        const totalCogs = cogsData.reduce((acc, data) => {
          acc.budgeted += data.budgeted;
          acc.actual += data.actual;
          return acc;
        }, { budgeted: 0, actual: 0, variance: 0, percentage: 0 });
        totalCogs.variance = totalCogs.budgeted - totalCogs.actual;
        totalCogs.percentage = totalCogs.budgeted ? (totalCogs.variance / totalCogs.budgeted) * 100 : (totalCogs.actual > 0 ? -100 : 0);

        csvContent += summaryRow('Less: Cost of Goods Sold', totalCogs) + '\n';
        cogsData.forEach(d => { csvContent += row(d.name, d) + '\n'; });

        const grossProfit = {
          budgeted: totalIncome.budgeted - totalCogs.budgeted,
          actual: totalIncome.actual - totalCogs.actual,
          variance: 0, percentage: 0
        };
        grossProfit.variance = grossProfit.actual - grossProfit.budgeted;
        grossProfit.percentage = grossProfit.budgeted ? (grossProfit.variance / grossProfit.budgeted) * 100 : (grossProfit.actual !== 0 ? 100 : 0);
        csvContent += summaryRow('Gross Profit', grossProfit) + '\n';
        
        const overheadCats = ['Salaries and Wages', 'Rent', 'Utilities', 'Marketing and Advertising', 'Office Supplies', 'Software and Subscriptions', 'Taxes', 'Travel', 'Repairs and Maintenance', 'Other'];
        const overheadsData = allData.filter(d => overheadCats.includes(d.name) && !d.isIncome);
        const totalOverheads = overheadsData.reduce((acc, data) => {
          acc.budgeted += data.budgeted;
          acc.actual += data.actual;
          return acc;
        }, { budgeted: 0, actual: 0, variance: 0, percentage: 0 });
        totalOverheads.variance = totalOverheads.budgeted - totalOverheads.actual;
        totalOverheads.percentage = totalOverheads.budgeted ? (totalOverheads.variance / totalOverheads.budgeted) * 100 : (totalOverheads.actual > 0 ? -100 : 0);

        csvContent += summaryRow('Less: Overheads', totalOverheads) + '\n';
        overheadsData.forEach(d => { csvContent += row(d.name, d) + '\n'; });
        
        const netProfit = {
            budgeted: grossProfit.budgeted - totalOverheads.budgeted,
            actual: grossProfit.actual - totalOverheads.actual,
            variance: 0, percentage: 0
        };
        netProfit.variance = netProfit.actual - netProfit.budgeted;
        netProfit.percentage = netProfit.budgeted ? (netProfit.variance / netProfit.budgeted) * 100 : (netProfit.actual !== 0 ? 100 : 0);
        csvContent += summaryRow('Net Profit', netProfit) + '\n';
      
      } else if (reportType === 'cash-flow-statement') {
        const months = eachMonthOfInterval({ start: startDate, end: endDate });
        const monthHeaders = months.map(m => format(m, 'MMM-yy')).join(',');
        
        csvContent = `Cash Flow Statement\n`;
        csvContent += `For period ${format(startDate, 'd MMM yyyy')} to ${format(endDate, 'd MMM yyyy')}\n\n`;

        // Calculate beginning balance
        const openingBalance = allTransactions
            .filter(t => {
                const tDate = toDate(t.date);
                return tDate && isBefore(tDate, startOfMonth(startDate));
            })
            .reduce((acc, t) => acc + (t.category === 'Income' ? t.amount : -t.amount), 0);

        let runningBalance = openingBalance;
        
        const transactionsInRange = allTransactions.filter(t => {
            const tDate = toDate(t.date);
            return tDate && isWithinInterval(tDate, {start: startDate, end: endDate});
        });
        
        const incomeCategories = [...new Set(transactionsInRange.filter(t => t.category === 'Income').map(t => t.subcategory))];
        const expenseCategories = [...new Set(transactionsInRange.filter(t => t.category === 'Expense').map(t => t.subcategory))];

        const monthlyData = months.map(month => {
            const monthStart = startOfMonth(month);
            const monthEnd = endOfMonth(month);
            
            const transactionsThisMonth = allTransactions.filter(t => {
                const tDate = toDate(t.date);
                return tDate && isWithinInterval(tDate, { start: monthStart, end: monthEnd });
            });
            
            const incomeByCategory = incomeCategories.reduce((acc, cat) => {
                acc[cat] = transactionsThisMonth.filter(t => t.category === 'Income' && t.subcategory === cat).reduce((sum, t) => sum + t.amount, 0);
                return acc;
            }, {} as Record<string, number>);

            const expenseByCategory = expenseCategories.reduce((acc, cat) => {
                acc[cat] = transactionsThisMonth.filter(t => t.category === 'Expense' && t.subcategory === cat).reduce((sum, t) => sum + t.amount, 0);
                return acc;
            }, {} as Record<string, number>);

            const totalInflow = Object.values(incomeByCategory).reduce((sum, amount) => sum + amount, 0);
            const totalOutflow = Object.values(expenseByCategory).reduce((sum, amount) => sum + amount, 0);
            
            const netCashFlow = totalInflow - totalOutflow;
            const currentMonthOpening = runningBalance;
            const closingBalance = currentMonthOpening + netCashFlow;
            runningBalance = closingBalance;

            return {
                incomeByCategory,
                expenseByCategory,
                totalInflow,
                totalOutflow,
                netCashFlow,
                openingBalance: currentMonthOpening,
                closingBalance
            };
        });

        const rows: { [key: string]: string[] } = {};
        
        rows['Cash Inflow'] = Array(months.length).fill('');
        incomeCategories.forEach(cat => {
            rows[cat] = monthlyData.map(d => formatCurrencyForCSV(d.incomeByCategory[cat] || 0));
        });
        rows['Total cash inflow'] = monthlyData.map(d => formatCurrencyForCSV(d.totalInflow));

        rows[''] = Array(months.length).fill(''); // Spacer

        rows['Cash Outflow'] = Array(months.length).fill('');
        expenseCategories.forEach(cat => {
            rows[cat] = monthlyData.map(d => formatCurrencyForCSV(d.expenseByCategory[cat] || 0));
        });
        rows['Total cash outflow'] = monthlyData.map(d => formatCurrencyForCSV(d.totalOutflow));

        rows[' '] = Array(months.length).fill(''); // Spacer

        rows['Net cash flow'] = monthlyData.map(d => formatCurrencyForCSV(d.netCashFlow));
        rows['Opening balance'] = monthlyData.map(d => formatCurrencyForCSV(d.openingBalance));
        rows['Closing balance'] = monthlyData.map(d => formatCurrencyForCSV(d.closingBalance));

        csvContent += `Category,${monthHeaders}\n`;
        for (const [title, values] of Object.entries(rows)) {
            csvContent += `"${title}",${values.join(',')}\n`;
        }


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

      const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement('a');
      if (link.download !== undefined) {
        const url = URL.createObjectURL(blob);
        link.setAttribute('href', url);
        link.setAttribute(
          'download',
          `report-${reportType}-${format(new Date(), 'yyyy-MM-dd')}.csv`
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

    