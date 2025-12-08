
"use client"

import { useState, useMemo } from "react";
import { format, startOfYear, endOfYear, eachMonthOfInterval, startOfMonth, endOfMonth, isWithinInterval, addDays, addWeeks, addMonths, addYears, isAfter, isBefore, isEqual, startOfDay, subMonths } from "date-fns";
import { DollarSign, Loader2, TrendingDown, TrendingUp, CalendarIcon, Wallet } from "lucide-react";
import type { Transaction, RecurringTransaction } from "@/lib/types";
import { useCollection, useFirestore, useMemoFirebase, useUser } from '@/firebase';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { collection, query, orderBy, Timestamp } from 'firebase/firestore';
import { cn } from "@/lib/utils";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { PageHeader } from "@/components/dashboard/page-header";
import { useLanguage } from "@/context/language-context";

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
}

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
    
    // Determine the real end date for generation, which is the minimum of periodEnd and today.
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

export default function StatementPage() {
  const firestore = useFirestore();
  const { user } = useUser();
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const { t } = useLanguage();
  
  const singleTransactionsQuery = useMemoFirebase(() => {
    if (!user) return null;
    return query(collection(firestore, 'users', user.uid, 'expenses'), orderBy('date', 'asc'));
  }, [firestore, user]);

  const recurringTransactionsQuery = useMemoFirebase(() => {
    if (!user) return null;
    return query(collection(firestore, 'users', user.uid, 'recurringTransactions'));
  }, [firestore, user]);

  const { data: singleTransactions, isLoading: isLoadingSingle } = useCollection<Transaction>(singleTransactionsQuery);
  const { data: recurringTransactions, isLoading: isLoadingRecurring } = useCollection<RecurringTransaction>(recurringTransactionsQuery);

  const { monthlyData, beginningBalance, totalInflows, totalOutflows, endingBalance } = useMemo(() => {
    if (!singleTransactions || !recurringTransactions) {
      return {
        monthlyData: [],
        beginningBalance: 0,
        totalInflows: 0,
        totalOutflows: 0,
        endingBalance: 0,
      };
    }
    
    const yearStart = startOfYear(selectedDate);
    const monthStart = startOfMonth(selectedDate);
    const today = startOfDay(new Date());

    // Define the overall period for which we need data (all-time up to today for balances)
    const allTimeStart = new Date(0);
    
    // Generate recurring instances efficiently only for the required period
    const recurringInstancesAllTime = generateTransactionInstances(recurringTransactions, allTimeStart, today);

    const allSingleTransactions = singleTransactions.filter(t => {
      const d = toDate(t.date);
      return d && (isBefore(d, today) || isEqual(d, today));
    });

    // Combine all transactions that have occurred up to today
    const allTransactions = [...allSingleTransactions, ...recurringInstancesAllTime];

    // Calculate beginning balance for the selected month
    const beginningBalance = allTransactions
      .filter(t => {
        const transactionDate = toDate(t.date);
        return transactionDate && isBefore(transactionDate, monthStart);
      })
      .reduce((acc, t) => acc + (t.category === 'Income' ? t.amount : -t.amount), 0);
      
    // Calculate initial balance at the start of the selected year
    let runningBalance = allTransactions
        .filter(t => {
            const transactionDate = toDate(t.date);
            return transactionDate && isBefore(transactionDate, yearStart);
        })
        .reduce((acc, t) => acc + (t.category === 'Income' ? t.amount : -t.amount), 0);

    const monthsInYear = eachMonthOfInterval({ start: yearStart, end: endOfYear(selectedDate) });

    const monthlyData = monthsInYear.map(month => {
      // Only calculate for months up to and including the current month of the current year
      if (isAfter(month, today)) {
        return null;
      }
      
      const monthStartLoop = startOfMonth(month);
      const monthEndLoop = endOfMonth(month);

      const inflows = allTransactions
        .filter(t => {
          const transactionDate = toDate(t.date);
          return transactionDate && isWithinInterval(transactionDate, { start: monthStartLoop, end: monthEndLoop }) && t.category === 'Income';
        })
        .reduce((sum, t) => sum + t.amount, 0);

      const outflows = allTransactions
        .filter(t => {
          const transactionDate = toDate(t.date);
          return transactionDate && isWithinInterval(transactionDate, { start: monthStartLoop, end: monthEndLoop }) && (t.category === 'Expense' || t.category === 'Liability');
        })
        .reduce((sum, t) => sum + t.amount, 0);
      
      const netChange = inflows - outflows;
      const monthEndingBalance = runningBalance + netChange;
      runningBalance = monthEndingBalance; // Update running balance for the next month

      return {
        month: month,
        inflows,
        outflows,
        netChange,
        endingBalance: monthEndingBalance,
      };
    }).filter(Boolean) as { month: Date; inflows: number; outflows: number; netChange: number; endingBalance: number; }[];

    // Calculate totals for the selected month for the cards
    const monthEnd = endOfMonth(selectedDate);
    const selectedMonthTransactions = allTransactions.filter(t => {
        const tDate = toDate(t.date);
        // Ensure we only include transactions within the selected month up to today
        return tDate && isWithinInterval(tDate, { start: monthStart, end: monthEnd > today ? today : monthEnd });
    });

    const totalInflows = selectedMonthTransactions.filter(t => t.category === 'Income').reduce((sum, t) => sum + t.amount, 0);
    const totalOutflows = selectedMonthTransactions.filter(t => t.category === 'Expense' || t.category === 'Liability').reduce((sum, t) => sum + t.amount, 0);
    
    // The final ending balance is the last calculated running balance
    const endingBalance = runningBalance;
    
    return {
      monthlyData,
      beginningBalance,
      totalInflows,
      totalOutflows,
      endingBalance
    };

  }, [singleTransactions, recurringTransactions, selectedDate]);

  const isLoading = isLoadingSingle || isLoadingRecurring;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-8">
          <Loader2 className="mr-2 h-8 w-8 animate-spin" />
          <p>{t('loadingStatementData')}</p>
      </div>
    )
  }

  return (
    <div className="grid gap-6">
       <PageHeader
            title={t('cashFlowStatement')}
            description={t('cashFlowStatementDescription')}
        />
       <div className="flex justify-end">
            <Popover>
                <PopoverTrigger asChild>
                <Button variant="outline">
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {format(selectedDate, "MMMM yyyy")}
                </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0">
                <Calendar
                    mode="single"
                    selected={selectedDate}
                    onSelect={(date) => {
                        if(date) setSelectedDate(date);
                    }}
                    initialFocus
                    captionLayout="dropdown-buttons" 
                    fromYear={2020}
                    toYear={new Date().getFullYear() + 5}
                />
                </PopoverContent>
            </Popover>
        </div>
      <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
          <Card>
            <CardHeader className="flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium">{t('beginningBalance')}</CardTitle>
                <DollarSign className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
                <div className="text-2xl font-bold">₱{beginningBalance.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
                <p className="text-xs text-muted-foreground">{t('asOf')} {format(startOfMonth(selectedDate), "MMM d, yyyy")}</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium">{t('totalCashInflows')}</CardTitle>
                <TrendingUp className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
                <div className="text-2xl font-bold text-green-600">+₱{totalInflows.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
                <p className="text-xs text-muted-foreground">{t('totalIncomeIn')} {format(selectedDate, "MMMM yyyy")}</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium">{t('totalCashOutflows')}</CardTitle>
                <TrendingDown className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
                <div className="text-2xl font-bold text-red-600">-₱{totalOutflows.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
                <p className="text-xs text-muted-foreground">{t('totalExpensesIn')} {format(selectedDate, "MMMM yyyy")}</p>
            </CardContent>
          </Card>
           <Card>
            <CardHeader className="flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium">{t('endingCashBalance')}</CardTitle>
                <Wallet className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
                <div className="text-2xl font-bold">₱{endingBalance.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
                <p className="text-xs text-muted-foreground">{t('asOf')} {format(new Date(), "MMM d, yyyy")}</p>
            </CardContent>
          </Card>
      </div>
       <Card>
        <CardHeader>
          <CardTitle>{t('monthlyCashFlowStatement')}</CardTitle>
          <CardDescription>{t('monthlyCashFlowStatementDescription')} {format(selectedDate, "yyyy")}.</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t('month')}</TableHead>
                <TableHead className="text-right">{t('cashIn')}</TableHead>
                <TableHead className="text-right">{t('cashOut')}</TableHead>
                <TableHead className="text-right">{t('netChange')}</TableHead>
                <TableHead className="text-right">{t('endingBalance')}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {monthlyData.map((entry) => (
                <TableRow key={entry.month.toISOString()}>
                  <TableCell className="font-medium">{format(entry.month, "MMMM")}</TableCell>
                  <TableCell className="text-right text-green-600">
                    {entry.inflows > 0 ? `+₱${entry.inflows.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : '-'}
                  </TableCell>
                  <TableCell className="text-right text-red-600">
                    {entry.outflows > 0 ? `-₱${entry.outflows.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : '-'}
                  </TableCell>
                  <TableCell className={cn("text-right font-medium", entry.netChange >= 0 ? 'text-green-600' : 'text-red-600')}>
                     {entry.netChange >= 0 ? '+' : ''}₱{entry.netChange.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </TableCell>
                  <TableCell className="text-right font-bold">
                    ₱{entry.endingBalance.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          {monthlyData.length === 0 && !isLoading && (
            <div className="text-center p-8 text-muted-foreground">
              {t('noTransactionsForYear')}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
