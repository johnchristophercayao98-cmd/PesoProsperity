
"use client"

import { useState, useMemo } from "react";
import { format, startOfYear, endOfYear, eachMonthOfInterval, startOfMonth, endOfMonth, isWithinInterval, addDays, addWeeks, addMonths, addYears, isAfter, isBefore, isEqual } from "date-fns";
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

const toDate = (date: any): Date | undefined => {
  if (!date) return undefined;
  if (date instanceof Date) return date;
  if (date instanceof Timestamp) return date.toDate();
  if (typeof date === 'string' || typeof date === 'number') return new Date(date);
  return undefined;
}

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

export function CashflowStatement() {
  const firestore = useFirestore();
  const { user } = useUser();
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  
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
    const yearEnd = endOfYear(selectedDate);

    // Generate instances for the selected year and all prior years to calculate beginning balance
    const veryFirstDate = singleTransactions[0] ? toDate(singleTransactions[0].date) : new Date();
    const recurringInstancesAllTime = generateTransactionInstances(recurringTransactions, veryFirstDate || new Date(0), yearEnd);
    const allTransactions = [...singleTransactions, ...recurringInstancesAllTime];

    const beginningBalance = allTransactions
      .filter(t => {
        const transactionDate = toDate(t.date);
        return transactionDate && transactionDate < yearStart;
      })
      .reduce((acc, t) => acc + (t.category === 'Income' ? t.amount : -t.amount), 0);
      
    const monthsInYear = eachMonthOfInterval({ start: yearStart, end: yearEnd });
    let runningBalance = beginningBalance;

    const monthlyData = monthsInYear.map(month => {
      const monthStart = startOfMonth(month);
      const monthEnd = endOfMonth(month);

      const inflows = allTransactions
        .filter(t => {
          const transactionDate = toDate(t.date);
          return transactionDate && isWithinInterval(transactionDate, { start: monthStart, end: monthEnd }) && t.category === 'Income';
        })
        .reduce((sum, t) => sum + t.amount, 0);

      const outflows = allTransactions
        .filter(t => {
          const transactionDate = toDate(t.date);
          return transactionDate && isWithinInterval(transactionDate, { start: monthStart, end: monthEnd }) && t.category !== 'Income';
        })
        .reduce((sum, t) => sum + t.amount, 0);
      
      const netChange = inflows - outflows;
      runningBalance += netChange;

      return {
        month: month,
        inflows,
        outflows,
        netChange,
        endingBalance: runningBalance,
      };
    });

    const totalInflows = monthlyData.reduce((sum, entry) => sum + entry.inflows, 0);
    const totalOutflows = monthlyData.reduce((sum, entry) => sum + entry.outflows, 0);
    
    return {
      monthlyData,
      beginningBalance,
      totalInflows,
      totalOutflows,
      endingBalance: runningBalance
    };

  }, [singleTransactions, recurringTransactions, selectedDate]);

  const isLoading = isLoadingSingle || isLoadingRecurring;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-8">
          <Loader2 className="mr-2 h-8 w-8 animate-spin" />
          <p>Loading statement data...</p>
      </div>
    )
  }

  return (
    <div className="grid gap-6">
       <div className="flex justify-end">
            <Popover>
                <PopoverTrigger asChild>
                <Button variant="outline">
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {format(selectedDate, "yyyy")}
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
                    toYear={2030}
                />
                </PopoverContent>
            </Popover>
        </div>
      <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
          <Card>
            <CardHeader className="flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium">Beginning Balance</CardTitle>
                <DollarSign className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
                <div className="text-2xl font-bold">₱{beginningBalance.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
                <p className="text-xs text-muted-foreground">As of {format(startOfYear(selectedDate), "MMM d, yyyy")}</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium">Total Cash Inflows</CardTitle>
                <TrendingUp className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
                <div className="text-2xl font-bold text-green-600">+₱{totalInflows.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
                <p className="text-xs text-muted-foreground">Total income in {format(selectedDate, "yyyy")}</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium">Total Cash Outflows</CardTitle>
                <TrendingDown className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
                <div className="text-2xl font-bold text-red-600">-₱{totalOutflows.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
                <p className="text-xs text-muted-foreground">Total expenses in {format(selectedDate, "yyyy")}</p>
            </CardContent>
          </Card>
           <Card>
            <CardHeader className="flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium">Ending Cash Balance</CardTitle>
                <Wallet className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
                <div className="text-2xl font-bold">₱{endingBalance.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
                <p className="text-xs text-muted-foreground">As of {format(endOfYear(selectedDate), "MMM d, yyyy")}</p>
            </CardContent>
          </Card>
      </div>
       <Card>
        <CardHeader>
          <CardTitle>Monthly Cash Flow Statement</CardTitle>
          <CardDescription>Aggregated cash movements for each month in {format(selectedDate, "yyyy")}.</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Month</TableHead>
                <TableHead className="text-right">Cash In</TableHead>
                <TableHead className="text-right">Cash Out</TableHead>
                <TableHead className="text-right">Net Change</TableHead>
                <TableHead className="text-right">Ending Balance</TableHead>
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
              No transactions found for the selected year.
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
