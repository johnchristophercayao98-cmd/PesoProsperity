
"use client"

import { useMemo, useState } from "react";
import { addMonths, format, startOfMonth, endOfMonth, isWithinInterval, subMonths } from "date-fns";
import { Calendar as CalendarIcon, DollarSign, Info, Loader2, TrendingDown, TrendingUp } from "lucide-react";
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

import type { Transaction, RecurringTransaction } from "@/lib/types";
import { useCollection, useFirestore, useMemoFirebase, useUser } from '@/firebase';
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ChartContainer, ChartLegend, ChartLegendContent, ChartTooltipContent } from "@/components/ui/chart";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { collection, query, Timestamp } from 'firebase/firestore';


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
  
  const firestore = useFirestore();
  const { user } = useUser();
  
  const transactionsQuery = useMemoFirebase(() => {
    if (!user) return null;
    return query(collection(firestore, 'users', user.uid, 'expenses'));
  }, [firestore, user]);
  
  const recurringQuery = useMemoFirebase(() => {
    if (!user) return null;
    return query(collection(firestore, 'users', user.uid, 'recurringTransactions'));
  }, [firestore, user]);

  const { data: transactions, isLoading: isLoadingTransactions } = useCollection<Transaction>(transactionsQuery);
  const { data: recurringTransactions, isLoading: isLoadingRecurring } = useCollection<RecurringTransaction>(recurringQuery);

  const { forecastData, initialBalance, netCashFlow, lowestPoint, lowestPointMonth } = useMemo(() => {
    const now = new Date();
    if (!transactions || !recurringTransactions) {
      return {
        forecastData: [],
        initialBalance: 0,
        netCashFlow: 0,
        lowestPoint: 0,
        lowestPointMonth: ''
      };
    }

    // 1. Calculate Initial Balance from all non-recurring transactions
    const totalIncome = transactions
        .filter(t => t.category === 'Income')
        .reduce((sum, t) => sum + t.amount, 0);
    const totalExpenses = transactions
        .filter(t => t.category !== 'Income')
        .reduce((sum, t) => sum + t.amount, 0);
    const initialBalance = totalIncome - totalExpenses;

    // 2. Generate Forecast Data for the next 6 months based on recurring transactions
    const forecast = [];
    let lastBalance = initialBalance;

    for (let i = 0; i < 6; i++) {
        const date = addMonths(selectedDate, i);
        const monthStart = startOfMonth(date);
        const monthEnd = endOfMonth(date);

        // Filter recurring transactions that are active in this month
        const monthlyRecurring = recurringTransactions.filter(t => {
            const startDate = toDate(t.startDate);
            const endDate = toDate(t.endDate);
            if (!startDate) return false;
            // Check if the recurring transaction period overlaps with the forecast month
            const startsBeforeOrInMonth = startDate <= monthEnd;
            const endsAfterOrInMonth = !endDate || endDate >= monthStart;
            return startsBeforeOrInMonth && endsAfterOrInMonth;
        });
        
        const monthlyCashIn = monthlyRecurring
            .filter(t => t.category === 'Income')
            .reduce((sum, t) => sum + t.amount, 0);
            
        const monthlyCashOut = monthlyRecurring
            .filter(t => t.category === 'Expense')
            .reduce((sum, t) => sum + t.amount, 0);

        const balance = lastBalance + monthlyCashIn - monthlyCashOut;

        forecast.push({
            month: format(date, "MMM yyyy"),
            cashIn: monthlyCashIn,
            cashOut: monthlyCashOut,
            balance
        });
        lastBalance = balance;
    }

    const netCashFlow = forecast.reduce((acc, d) => acc + d.cashIn - d.cashOut, 0);
    const allBalances = [initialBalance, ...forecast.map(d => d.balance)];
    const lowestPoint = allBalances.length > 0 ? Math.min(...allBalances) : 0;
    
    let lowestPointMonth = format(selectedDate, "MMM yyyy");
    if(lowestPoint !== initialBalance){
      const lowestPointMonthObj = forecast.find(d => d.balance === lowestPoint);
      if (lowestPointMonthObj) {
        lowestPointMonth = lowestPointMonthObj.month;
      }
    }


    return { forecastData: forecast, initialBalance, netCashFlow, lowestPoint, lowestPointMonth };

  }, [transactions, recurringTransactions, selectedDate]);


  if (isLoadingTransactions || isLoadingRecurring) {
    return (
      <div className="flex items-center justify-center p-8">
          <Loader2 className="mr-2 h-8 w-8 animate-spin" />
          <p>Loading forecast data...</p>
      </div>
    )
  }

  return (
    <div className="grid gap-6">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <Alert className="w-full sm:w-fit">
                <Info className="h-4 w-4" />
                <AlertTitle>Cash Reserve Reminder</AlertTitle>
                <AlertDescription>
                Maintain a sufficient cash reserve to cover expenses during low-sales months. We recommend at least 3 months of operating expenses.
                </AlertDescription>
            </Alert>
            <Popover>
                <PopoverTrigger asChild>
                <Button variant="outline" className="w-full sm:w-auto">
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
            <CardDescription>Starting from {format(selectedDate, "MMMM yyyy")}. Based on recurring transactions.</CardDescription>
          </CardHeader>
          <CardContent>
            <ChartContainer config={chartConfig} className="h-[350px] w-full">
              <ResponsiveContainer>
                <LineChart data={forecastData}>
                  <CartesianGrid vertical={false} />
                  <XAxis dataKey="month" tickLine={false} axisLine={false} tickMargin={8} />
                  <YAxis tickFormatter={(value) => `₱${(value/1000).toFixed(0)}k`} />
                  <Tooltip
                    content={
                      <ChartTooltipContent
                        formatter={(value, name) => {
                          const formattedValue = `₱${Math.abs(Number(value)).toLocaleString(undefined, { maximumFractionDigits: 0})}`;
                          if (name === "cashIn") return [`+${formattedValue}`, "Projected Cash In"]
                          if (name === "cashOut") return [`-${formattedValue}`, "Projected Cash Out"]
                          return [formattedValue, "Projected Balance"]
                        }}
                      />
                    }
                  />
                  <ChartLegend content={<ChartLegendContent />} />
                  <Line type="monotone" dataKey="balance" stroke="var(--color-balance)" strokeWidth={2} dot={true} />
                  <Line type="monotone" dataKey="cashIn" stroke="var(--color-cashIn)" strokeWidth={2} dot={false} strokeDasharray="5 5" />
                  <Line type="monotone" dataKey="cashOut" stroke="var(--color-cashOut)" strokeWidth={2} dot={false} strokeDasharray="5 5" />
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
                        {netCashFlow >= 0 ? '+' : '-'}₱{Math.abs(netCashFlow).toLocaleString(undefined, { maximumFractionDigits: 0})}
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
                    <div className={`text-2xl font-bold ${lowestPoint < 0 ? 'text-red-600' : ''}`}>₱{lowestPoint.toLocaleString(undefined, { maximumFractionDigits: 0})}</div>
                    <p className="text-xs text-muted-foreground">in {lowestPointMonth}</p>
                </CardContent>
             </Card>
             <Card>
                <CardHeader className="flex-row items-center justify-between pb-2">
                    <CardTitle className="text-sm font-medium">Starting Cash Balance</CardTitle>
                    <DollarSign className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                    <div className="text-2xl font-bold">₱{initialBalance.toLocaleString(undefined, { maximumFractionDigits: 0})}</div>
                    <p className="text-xs text-muted-foreground">Current available cash</p>
                </CardContent>
             </Card>
        </div>
      </div>
    </div>
  )
}
