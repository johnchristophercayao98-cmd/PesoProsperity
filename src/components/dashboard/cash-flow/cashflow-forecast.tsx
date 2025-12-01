
"use client"

import { useState, useEffect, useMemo } from "react";
import { format, addMonths, startOfMonth, endOfMonth, isWithinInterval } from "date-fns";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { DollarSign, TrendingDown, TrendingUp, Info, Calendar as CalendarIcon, Loader2 } from "lucide-react"
import { Line, LineChart, CartesianGrid, XAxis, YAxis, ResponsiveContainer, Tooltip } from "recharts"
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  ChartLegend,
  ChartLegendContent,
} from "@/components/ui/chart"
import { Popover, PopoverTrigger, PopoverContent } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { Button } from "@/components/ui/button";
import type { Budget, Transaction, RecurringTransaction, Debt } from "@/lib/types";
import {
  useFirestore,
  useUser,
  useCollection,
  useMemoFirebase,
} from '@/firebase';
import { collection, query, where, Timestamp } from 'firebase/firestore';


const chartConfig = {
    balance: { label: "Cash Balance", color: "hsl(var(--chart-1))" },
    cashIn: { label: "Cash In", color: "hsl(var(--chart-2))" },
    cashOut: { label: "Cash Out", color: "hsl(var(--destructive))" },
}

const toDate = (date: any): Date | undefined => {
  if (!date) return undefined;
  if (date instanceof Date) return date;
  if (date instanceof Timestamp) return date.toDate();
  if (typeof date === 'string' || typeof date === 'number') return new Date(date);
  return undefined;
}

export function CashflowForecast() {
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [forecastData, setForecastData] = useState<any[]>([]);
  const [initialBalance, setInitialBalance] = useState(0);

  const firestore = useFirestore();
  const { user } = useUser();

  const budgetsQuery = useMemoFirebase(() => {
    if (!user) return null;
    return query(collection(firestore, 'users', user.uid, 'budgets'));
  }, [firestore, user]);

  const transactionsQuery = useMemoFirebase(() => {
    if (!user) return null;
    return query(collection(firestore, 'users', user.uid, 'expenses'));
  }, [firestore, user]);

  const recurringQuery = useMemoFirebase(() => {
    if (!user) return null;
    return query(collection(firestore, 'users', user.uid, 'recurringTransactions'));
  }, [firestore, user]);

  const { data: budgets, isLoading: isLoadingBudgets } = useCollection<Budget>(budgetsQuery);
  const { data: transactions, isLoading: isLoadingTransactions } = useCollection<Transaction>(transactionsQuery);
  const { data: recurring, isLoading: isLoadingRecurring } = useCollection<RecurringTransaction>(recurringQuery);
  
  const isLoading = isLoadingBudgets || isLoadingTransactions || isLoadingRecurring;

  useEffect(() => {
    if (isLoading || !transactions) return;

    const currentMonthStart = startOfMonth(new Date());
    const currentMonthEnd = endOfMonth(new Date());

    const incomeThisMonth = transactions
        .filter(t => t.category === 'Income' && isWithinInterval(toDate(t.date)!, { start: currentMonthStart, end: currentMonthEnd }))
        .reduce((sum, t) => sum + t.amount, 0);

    const expensesThisMonth = transactions
        .filter(t => t.category === 'Expense' && isWithinInterval(toDate(t.date)!, { start: currentMonthStart, end: currentMonthEnd }))
        .reduce((sum, t) => sum + t.amount, 0);

    setInitialBalance(incomeThisMonth - expensesThisMonth);
  }, [transactions, isLoading])

  useEffect(() => {
    if (isLoading || !budgets || !recurring) return;

    const generateForecastData = (startDate: Date) => {
        const data = [];
        let lastBalance = initialBalance;

        for (let i = 0; i < 6; i++) {
            const date = addMonths(startDate, i);
            const monthStart = startOfMonth(date);
            const monthEnd = endOfMonth(date);

            const relevantBudget = budgets.find(b => {
              const budgetStart = toDate(b.startDate)!;
              return budgetStart.getMonth() === date.getMonth() && budgetStart.getFullYear() === date.getFullYear();
            });
            
            const budgetedIncome = relevantBudget?.income.reduce((sum, item) => sum + item.budgeted, 0) || 0;
            const budgetedExpenses = relevantBudget?.expenses.reduce((sum, item) => sum + item.budgeted, 0) || 0;

            const recurringIncome = recurring
              .filter(r => r.category === 'Income' && toDate(r.startDate)! <= monthEnd && (!r.endDate || toDate(r.endDate)! >= monthStart))
              .reduce((sum, r) => sum + r.amount, 0);
            
            const recurringExpenses = recurring
              .filter(r => r.category === 'Expense' && toDate(r.startDate)! <= monthEnd && (!r.endDate || toDate(r.endDate)! >= monthStart))
              .reduce((sum, r) => sum + r.amount, 0);

            const cashIn = budgetedIncome + recurringIncome;
            const cashOut = budgetedExpenses + recurringExpenses;
            const balance = lastBalance + cashIn - cashOut;

            data.push({
                month: format(date, "MMM yyyy"),
                cashIn,
                cashOut,
                balance
            });
            lastBalance = balance;
        }
        return data;
    }
    
    setForecastData(generateForecastData(selectedDate));
  }, [selectedDate, budgets, recurring, isLoading, initialBalance]);

  const lowestPoint = useMemo(() => Math.min(...forecastData.map(d => d.balance)), [forecastData]);
  const lowestPointMonth = useMemo(() => forecastData.find(d => d.balance === lowestPoint)?.month || '', [forecastData, lowestPoint]);
  const netCashFlow = useMemo(() => forecastData.reduce((acc, d) => acc + d.cashIn - d.cashOut, 0), [forecastData]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-8">
          <Loader2 className="mr-2 h-8 w-8 animate-spin" />
          <p>Loading forecast data...</p>
      </div>
    )
  }

  return (
    <div className="grid gap-6">
        <div className="flex items-center justify-between">
            <Alert className="w-fit">
                <Info className="h-4 w-4" />
                <AlertTitle>Cash Reserve Reminder</AlertTitle>
                <AlertDescription>
                Maintain a sufficient cash reserve to cover expenses during low-sales months. We recommend at least 3 months of operating expenses.
                </AlertDescription>
            </Alert>
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
                    toYear={2030}
                />
                </PopoverContent>
            </Popover>
        </div>
      <div className="grid md:grid-cols-3 gap-6">
        <Card className="md:col-span-2">
          <CardHeader>
            <CardTitle>6-Month Cash Flow Forecast</CardTitle>
            <CardDescription>Starting from {format(selectedDate, "MMMM yyyy")}.</CardDescription>
          </CardHeader>
          <CardContent>
            <ChartContainer config={chartConfig} className="h-[350px] w-full">
              <ResponsiveContainer>
                <LineChart data={forecastData}>
                  <CartesianGrid vertical={false} />
                  <XAxis dataKey="month" tickLine={false} axisLine={false} tickMargin={8} />
                  <YAxis tickFormatter={(value) => `₱${value/1000}k`} />
                  <ChartTooltip content={<ChartTooltipContent />} />
                  <ChartLegend content={<ChartLegendContent />} />
                  <Line type="monotone" dataKey="balance" stroke="var(--color-balance)" strokeWidth={2} dot={false} />
                  <Line type="monotone" dataKey="cashIn" stroke="var(--color-cashIn)" strokeWidth={2} dot={false} />
                  <Line type="monotone" dataKey="cashOut" stroke="var(--color-cashOut)" strokeWidth={2} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </ChartContainer>
          </CardContent>
        </Card>
        <div className="space-y-6">
             <Card>
                <CardHeader className="flex-row items-center justify-between pb-2">
                    <CardTitle className="text-sm font-medium">Projected Net Cash Flow</CardTitle>
                    {netCashFlow >= 0 ? <TrendingUp className="h-4 w-4 text-muted-foreground" /> : <TrendingDown className="h-4 w-4 text-muted-foreground" />}
                </CardHeader>
                <CardContent>
                    <div className={`text-2xl font-bold ${netCashFlow >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                        {netCashFlow >= 0 ? '+' : '-'}₱{Math.abs(netCashFlow).toLocaleString()}
                    </div>
                    <p className="text-xs text-muted-foreground">in the next 6 months</p>
                </CardContent>
             </Card>
             <Card>
                <CardHeader className="flex-row items-center justify-between pb-2">
                    <CardTitle className="text-sm font-medium">Lowest Projected Balance</CardTitle>
                    <TrendingDown className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                    <div className={`text-2xl font-bold ${lowestPoint < 0 ? 'text-red-600' : ''}`}>₱{lowestPoint.toLocaleString()}</div>
                    <p className="text-xs text-muted-foreground">in {lowestPointMonth}</p>
                </CardContent>
             </Card>
             <Card>
                <CardHeader className="flex-row items-center justify-between pb-2">
                    <CardTitle className="text-sm font-medium">Starting Cash Balance</CardTitle>
                    <DollarSign className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                    <div className="text-2xl font-bold">₱{initialBalance.toLocaleString()}</div>
                    <p className="text-xs text-muted-foreground">Current available cash</p>
                </CardContent>
             </Card>
        </div>
      </div>
    </div>
  )
}
