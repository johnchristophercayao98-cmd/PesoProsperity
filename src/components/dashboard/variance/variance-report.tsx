
"use client"

import { useState, useEffect, useMemo } from "react";
import { format, startOfMonth, endOfMonth, isWithinInterval, addDays, addWeeks, addMonths, addYears, isAfter, isBefore, isEqual } from "date-fns";
import type { Budget, Transaction, RecurringTransaction } from "@/lib/types";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { AlertCircle, TrendingDown, TrendingUp, Calendar as CalendarIcon, Loader2 } from "lucide-react"
import { Bar, BarChart, CartesianGrid, XAxis, YAxis, ResponsiveContainer, Cell } from "recharts"
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart"
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import {
  useFirestore,
  useUser,
  useCollection,
  useMemoFirebase,
} from '@/firebase';
import { collection, query, where, Timestamp } from 'firebase/firestore';

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
    periodEnd: Date
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
  
        if(isWithinInterval(currentDate, { start: periodStart, end: periodEnd })) {
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

export function VarianceReport() {
    const [selectedDate, setSelectedDate] = useState<Date>(new Date());
    
    const firestore = useFirestore();
    const { user } = useUser();

    const budgetsQuery = useMemoFirebase(() => {
        if (!user) return null;
        const monthStart = startOfMonth(selectedDate);
        const monthEnd = endOfMonth(selectedDate);
        return query(
          collection(firestore, 'users', user.uid, 'budgets'),
          where('startDate', '>=', monthStart),
          where('startDate', '<=', monthEnd)
        );
      }, [firestore, user, selectedDate]);

    const { data: budgets, isLoading: isBudgetsLoading } = useCollection<Budget>(budgetsQuery);

    const singleTransactionsQuery = useMemoFirebase(() => {
        if (!user) return null;
        return collection(firestore, 'users', user.uid, 'expenses');
    }, [firestore, user]);
      
    const recurringTransactionsQuery = useMemoFirebase(() => {
        if (!user) return null;
        return collection(firestore, 'users', user.uid, 'recurringTransactions');
    }, [firestore, user]);

    const { data: singleTransactions, isLoading: isSingleTransactionsLoading } = useCollection<Transaction>(singleTransactionsQuery);
    const { data: recurringTransactions, isLoading: isRecurringTransactionsLoading } = useCollection<RecurringTransaction>(recurringTransactionsQuery);

    const budget = useMemo(() => {
        const baseBudget = budgets?.[0] ?? null;
        if (!baseBudget) return null;
    
        const monthStart = startOfMonth(selectedDate);
        const monthEnd = endOfMonth(selectedDate);
    
        const recurringInstances = generateTransactionInstances(recurringTransactions || [], monthStart, monthEnd);
        const allTransactions = [...(singleTransactions || []), ...recurringInstances];

        const monthlyTransactions = allTransactions.filter((t) => {
          const transactionDate = toDate(t.date);
          return (
            transactionDate &&
            isWithinInterval(transactionDate, { start: monthStart, end: monthEnd })
          );
        });
    
        const calculateActuals = (categories: any[], type: 'Income' | 'Expense') => {
          return categories.map((category) => {
            const actual = monthlyTransactions
              .filter((t) => t.category === type && t.subcategory === category.name)
              .reduce((sum, t) => sum + t.amount, 0);
            return { ...category, actual };
          });
        };
    
        return {
          ...baseBudget,
          income: calculateActuals(baseBudget.income || [], 'Income'),
          expenses: calculateActuals(baseBudget.expenses || [], 'Expense'),
        };
      }, [budgets, singleTransactions, recurringTransactions, selectedDate]);

    const isLoading = isBudgetsLoading || isSingleTransactionsLoading || isRecurringTransactionsLoading;
    const { income = [], expenses = [] } = budget || {};
    const overspentItems = expenses.filter(item => item.actual > item.budgeted);

    const varianceData = expenses.map(item => ({
        name: item.name,
        variance: item.budgeted - item.actual,
    }));

    const chartConfig = {
      variance: {
        label: "Variance",
      },
    }

    if (isLoading) {
        return (
            <div className="flex items-center justify-center p-8">
                <Loader2 className="mr-2 h-8 w-8 animate-spin" />
                <p>Loading variance report...</p>
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
            {overspentItems.length > 0 && (
                <Alert variant="destructive">
                    <AlertCircle className="h-4 w-4" />
                    <AlertTitle>Overspending Alert!</AlertTitle>
                    <AlertDescription>
                        You have exceeded your budget in the following categories: {overspentItems.map(i => i.name).join(', ')}.
                    </AlertDescription>
                </Alert>
            )}

            {!budget ? (
                <Card>
                    <CardContent className="p-8 text-center">
                        <p>No budget found for {format(selectedDate, "MMMM yyyy")}.</p>
                        <p className="text-sm text-muted-foreground">Please create a budget in the Budget Planner page.</p>
                    </CardContent>
                </Card>
            ) : (
            <>
            <div className="grid md:grid-cols-2 gap-6">
                 <Card>
                    <CardHeader>
                        <CardTitle>Expense Variance Chart</CardTitle>
                        <CardDescription>For {format(selectedDate, "MMMM yyyy")}</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <ChartContainer config={chartConfig} className="h-[300px] w-full">
                           <ResponsiveContainer>
                             <BarChart data={varianceData} layout="vertical" margin={{left: 10}}>
                                <CartesianGrid horizontal={false} />
                                <YAxis dataKey="name" type="category" tickLine={false} axisLine={false} tickMargin={10} width={80} />
                                <XAxis dataKey="variance" type="number" hide />
                                <ChartTooltip cursor={false} content={<ChartTooltipContent />} />
                                <Bar dataKey="variance" radius={5}>
                                  {varianceData.map((entry, index) => (
                                      <Cell key={`cell-${index}`} fill={entry.variance < 0 ? 'hsl(var(--destructive))' : 'hsl(var(--chart-2))'} />
                                  ))}
                                </Bar>
                            </BarChart>
                           </ResponsiveContainer>
                        </ChartContainer>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader>
                        <CardTitle>Summary</CardTitle>
                        <CardDescription>For {format(selectedDate, "MMMM yyyy")}</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="flex items-center justify-between p-4 rounded-md bg-secondary/50">
                            <div>
                                <p className="text-sm text-muted-foreground">Total Budgeted</p>
                                <p className="text-2xl font-bold">₱{ (income.reduce((a, b) => a + b.budgeted, 0) - expenses.reduce((a, b) => a + b.budgeted, 0)).toLocaleString() }</p>
                            </div>
                            <div className="flex items-center justify-between p-4 rounded-md bg-secondary/50">
                                <p className="text-sm text-muted-foreground">Total Actual</p>
                                <p className="text-2xl font-bold">₱{ (income.reduce((a, b) => a + b.actual, 0) - expenses.reduce((a, b) => a + b.actual, 0)).toLocaleString() }</p>
                            </div>
                        </div>
                         <div className="flex items-center p-4 rounded-md border">
                            <TrendingUp className="h-6 w-6 mr-4 text-green-600"/>
                            <div>
                                <p className="text-sm text-muted-foreground">Favorable Variances (Savings)</p>
                                <p className="text-lg font-semibold">₱{expenses.filter(i => i.budgeted > i.actual).reduce((acc, i) => acc + (i.budgeted - i.actual), 0).toLocaleString()}</p>
                            </div>
                        </div>
                        <div className="flex items-center p-4 rounded-md border">
                            <TrendingDown className="h-6 w-6 mr-4 text-red-600"/>
                             <div>
                                <p className="text-sm text-muted-foreground">Unfavorable Variances (Overspent)</p>
                                <p className="text-lg font-semibold">₱{expenses.filter(i => i.budgeted < i.actual).reduce((acc, i) => acc + (i.actual - i.budgeted), 0).toLocaleString()}</p>
                            </div>
                        </div>
                    </CardContent>
                </Card>
            </div>
            
            <Card>
                <CardHeader>
                    <CardTitle>Detailed Report</CardTitle>
                    <CardDescription>For {format(selectedDate, "MMMM yyyy")}</CardDescription>
                </CardHeader>
                <CardContent>
                    <h3 className="text-lg font-semibold mb-2">Income</h3>
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Category</TableHead>
                                <TableHead className="text-right">Budgeted</TableHead>
                                <TableHead className="text-right">Actual</TableHead>
                                <TableHead className="text-right">Variance</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {income.map(item => {
                                const variance = item.actual - item.budgeted;
                                return (
                                    <TableRow key={item.name}>
                                        <TableCell>{item.name}</TableCell>
                                        <TableCell className="text-right">₱{item.budgeted.toLocaleString()}</TableCell>
                                        <TableCell className="text-right">₱{item.actual.toLocaleString()}</TableCell>
                                        <TableCell className="text-right"><Badge variant={variance >= 0 ? "default" : "destructive"} className={variance >= 0 ? "bg-green-600/80" : ""}>₱{Math.abs(variance).toLocaleString()}</Badge></TableCell>
                                    </TableRow>
                                );
                            })}
                        </TableBody>
                    </Table>

                    <h3 className="text-lg font-semibold mt-6 mb-2">Expenses</h3>
                     <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Category</TableHead>
                                <TableHead className="text-right">Budgeted</TableHead>
                                <TableHead className="text-right">Actual</TableHead>
                                <TableHead className="text-right">Variance</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {expenses.map(item => {
                                const variance = item.budgeted - item.actual;
                                return (
                                    <TableRow key={item.name}>
                                        <TableCell>{item.name}</TableCell>
                                        <TableCell className="text-right">₱{item.budgeted.toLocaleString()}</TableCell>
                                        <TableCell className="text-right">₱{item.actual.toLocaleString()}</TableCell>
                                        <TableCell className="text-right"><Badge variant={variance >= 0 ? "default" : "destructive"} className={variance >= 0 ? "bg-green-600/80" : ""}>₱{Math.abs(variance).toLocaleString()}</Badge></TableCell>
                                    </TableRow>
                                );
                            })}
                        </TableBody>
                    </Table>
                </CardContent>
            </Card>
            </>
            )}
        </div>
    )
}
