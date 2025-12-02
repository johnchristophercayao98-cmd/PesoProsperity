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
import { format } from 'date-fns';
import type { Transaction } from '@/lib/types';

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
      const transactionsQuery = query(
        collection(firestore, 'users', user.uid, 'expenses'),
        where('date', '>=', startDate),
        where('date', '<=', endDate)
      );

      const querySnapshot = await getDocs(transactionsQuery);
      const transactions = querySnapshot.docs.map(
        (doc) => ({ ...doc.data(), id: doc.id } as Transaction)
      );

      if (transactions.length === 0) {
        toast({
            variant: 'destructive',
            title: 'No Data Found',
            description: 'There are no transactions in the selected date range.',
        });
        return;
      }
      
      transactions.sort((a,b) => toDate(a.date)!.getTime() - toDate(b.date)!.getTime());

      let csvContent = '';
      if (reportType === 'income-vs-expense') {
        let totalIncome = 0;
        let totalExpense = 0;
        
        const dataRows = transactions.map(t => {
            const date = toDate(t.date);
            if (t.category === 'Income') {
                totalIncome += t.amount;
                return [
                    date ? format(date, 'd-MMM-yyyy') : '',
                    t.paymentMethod,
                    t.description,
                    t.category,
                    t.amount.toFixed(2),
                    ''
                ].join(',');
            } else {
                totalExpense += t.amount;
                return [
                    date ? format(date, 'd-MMM-yyyy') : '',
                    t.paymentMethod,
                    t.description,
                    t.category,
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

      } else {
        // Fallback for other report types
        const headers = 'Date,Description,Category,Subcategory,Amount,PaymentMethod\n';
        const rows = transactions
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
                Budget vs. Actual Variance
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
