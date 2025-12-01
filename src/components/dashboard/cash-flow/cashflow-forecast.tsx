
"use client"

import { useState, useEffect, useMemo } from "react";
import { format, addMonths, subMonths, startOfMonth, endOfMonth, isWithinInterval } from "date-fns";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { DollarSign, TrendingDown, TrendingUp, Info, Calendar as CalendarIcon, Loader2 } from "lucide-react"
import { LineChart, CartesianGrid, XAxis, YAxis, ResponsiveContainer, Tooltip } from "recharts"
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
import type { Transaction } from "@/lib/types";
import {
  useFirestore,
  useUser,
  useCollection,
  useMemoFirebase,
} from '@/firebase';
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

  const { data: transactions, isLoading: isLoadingTransactions } = useCollection<Transaction>(transactionsQuery);

  const { forecastData, initialBalance, netCashFlow, lowestPoint, lowestPointMonth } = useMemo(() => {
    if (!transactions) {
      return {
        forecastData: [],
        initialBalance: 0,
        netCashFlow: 0,
        lowestPoint: 0,
        lowestPointMonth: ''
      };
    }

    // 1. Calculate Initial Balance
    const totalIncome = transactions
        .filter(t => t.category === 'Income')
        .reduce((sum, t) => sum + t.amount, 0);
    const totalExpenses = transactions
        .filter(t => t.category !== 'Income')
        .reduce((sum, t) => sum + t.amount, 0);
    const initialBalance = totalIncome - totalExpenses;

    // 2. Calculate historical monthly averages
    const now = new Date();
    const twelveMonthsAgo = startOfMonth(subMonths(now, 11));
    const historicalTransactions = transactions.filter(t => {
      const transDate = toDate(t.date);
      return transDate && transDate >= twelveMonthsAgo && transDate <= now;
    });

    const monthlyIncome = historicalTransactions.filter(t => t.category === 'Income').reduce((sum, t) => sum + t.amount, 0);
    const monthlyExpenses = historicalTransactions.filter(t => t.category !== 'Income').reduce((sum, t) => sum + t.amount, 0);
    
    // Use 12 months for average, or less if data is sparse, but at least 1 to avoid division by zero
    const monthCount = Math.max(1, 12); 
    const avgMonthlyCashIn = monthlyIncome / monthCount;
    const avgMonthlyCashOut = monthlyExpenses / monthCount;
    
    // 3. Generate Forecast Data
    const forecast = [];
    let lastBalance = initialBalance;
    for (let i = 0; i < 6; i++) {
        const date = addMonths(selectedDate, i);
        const balance = lastBalance + avgMonthlyCashIn - avgMonthlyCashOut;

        forecast.push({
            month: format(date, "MMM yyyy"),
            cashIn: avgMonthlyCashIn,
            cashOut: avgMonthlyCashOut,
            balance
        });
        lastBalance = balance;
    }

    const netCashFlow = forecast.reduce((acc, d) => acc + d.cashIn - d.cashOut, 0);
    const lowestPoint = Math.min(...forecast.map(d => d.balance));
    const lowestPointMonth = forecast.find(d => d.balance === lowestPoint)?.month || '';

    return { forecastData: forecast, initialBalance, netCashFlow, lowestPoint, lowestPointMonth };

  }, [transactions, selectedDate]);


  if (isLoadingTransactions) {
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
            <CardDescription>Starting from {format(selectedDate, "MMMM yyyy")}. Based on historical averages.</CardDescription>
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
                          if (name === "cashIn") return [`+₱${value.toLocaleString(undefined, { maximumFractionDigits: 0})}`, "Avg. Monthly Cash In"]
                          if (name === "cashOut") return [`-₱${value.toLocaleString(undefined, { maximumFractionDigits: 0})}`, "Avg. Monthly Cash Out"]
                          return [`₱${value.toLocaleString(undefined, { maximumFractionDigits: 0})}`, "Projected Balance"]
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
