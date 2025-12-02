
"use client"
import { useMemo } from "react"
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Progress } from "@/components/ui/progress"
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  ChartLegend,
  ChartLegendContent,
} from "@/components/ui/chart"
import { Bar, BarChart, CartesianGrid, XAxis, YAxis, ResponsiveContainer } from "recharts"
import { cn } from "@/lib/utils"
import { format, startOfMonth, endOfMonth, subMonths, isWithinInterval, addDays, addWeeks, addMonths as dateFnsAddMonths, addYears, isAfter, isBefore, isEqual, startOfDay } from "date-fns"
import { useUser, useFirestore, useCollection, useMemoFirebase } from "@/firebase"
import { collection, query, orderBy, Timestamp } from "firebase/firestore"
import type { Transaction, FinancialGoal, RecurringTransaction } from "@/lib/types"
import { Loader2 } from "lucide-react"
import { Badge } from "@/components/ui/badge"

const chartConfig = {
  income: {
    label: "Income",
    color: "hsl(var(--chart-1))",
  },
  expenses: {
    label: "Expenses",
    color: "hsl(var(--chart-2))",
  },
}

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
          currentDate = dateFnsAddMonths(currentDate, 1);
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

export default function DashboardPage() {
  const { user } = useUser();
  const firestore = useFirestore();

  const singleTransactionsQuery = useMemoFirebase(() => {
    if (!user) return null;
    return query(collection(firestore, 'users', user.uid, 'expenses'), orderBy('date', 'desc'));
  }, [firestore, user]);

  const recurringTransactionsQuery = useMemoFirebase(() => {
    if (!user) return null;
    return query(collection(firestore, 'users', user.uid, 'recurringTransactions'));
  }, [firestore, user]);

  const goalsQuery = useMemoFirebase(() => {
    if (!user) return null;
    return query(collection(firestore, 'users', user.uid, 'financialGoals'));
  }, [firestore, user]);

  const { data: singleTransactions, isLoading: isLoadingSingle } = useCollection<Transaction>(singleTransactionsQuery);
  const { data: recurringTransactions, isLoading: isLoadingRecurring } = useCollection<RecurringTransaction>(recurringTransactionsQuery);
  const { data: financialGoals, isLoading: isLoadingGoals } = useCollection<FinancialGoal>(goalsQuery);

  const {
    netRevenue,
    totalExpenses,
    profitMargin,
    cashReserve,
    chartData,
    recentTransactions
  } = useMemo(() => {
    if (!singleTransactions || !recurringTransactions) {
      return {
        netRevenue: 0,
        totalExpenses: 0,
        profitMargin: 0,
        cashReserve: 0,
        chartData: [],
        recentTransactions: []
      };
    }

    const now = new Date();
    const today = startOfDay(now);
    
    const recurringAllTime = generateTransactionInstances(recurringTransactions, new Date(0), today);
    const allTransactions = [...singleTransactions, ...recurringAllTime].filter(t => {
        const transactionDate = toDate(t.date);
        return transactionDate && (isBefore(transactionDate, today) || isEqual(transactionDate, today));
    });

    const netRevenue = allTransactions.filter(t => t.category === 'Income').reduce((sum, t) => sum + t.amount, 0);
    const totalExpenses = allTransactions.filter(t => t.category !== 'Income').reduce((sum, t) => sum + t.amount, 0);
    const cashReserve = netRevenue - totalExpenses;
    const profitMargin = netRevenue > 0 ? ((netRevenue - totalExpenses) / netRevenue) * 100 : 0;
    
    const sixMonthsAgo = startOfMonth(subMonths(now, 5));
    const transactionsForChart = allTransactions.filter(t => {
      const transactionDate = toDate(t.date);
      return transactionDate && isWithinInterval(transactionDate, { start: sixMonthsAgo, end: today });
    });

    const chartData = Array.from({ length: 6 }).map((_, i) => {
      const date = subMonths(now, 5 - i);
      const monthStart = startOfMonth(date);
      const monthEnd = endOfMonth(date);
      
      const monthTransactions = transactionsForChart.filter(t => {
        const transactionDate = toDate(t.date);
        return transactionDate && isWithinInterval(transactionDate, { start: monthStart, end: monthEnd });
      });

      const income = monthTransactions.filter(t => t.category === 'Income').reduce((sum, t) => sum + t.amount, 0);
      const expenses = monthTransactions.filter(t => t.category !== 'Income').reduce((sum, t) => sum + t.amount, 0);

      return { month: format(date, 'MMM'), income, expenses };
    });
    
    const sortedRecent = [...allTransactions].sort((a,b) => toDate(b.date)!.getTime() - toDate(a.date)!.getTime());
    const recentTransactions = sortedRecent.slice(0, 5);

    return { netRevenue, totalExpenses, profitMargin, cashReserve, chartData, recentTransactions };

  }, [singleTransactions, recurringTransactions]);
  
  const mainStats = [
    {
      title: 'Net Revenue',
      value: `₱${netRevenue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
      change: 'All-time total',
    },
    {
      title: 'Total Expenses',
      value: `₱${totalExpenses.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
      change: 'All-time total',
    },
    {
      title: 'Profit Margin',
      value: `${profitMargin.toFixed(1)}%`,
      change: 'All-time total',
    },
    {
      title: 'Cash Reserve',
      value: `₱${cashReserve.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
      change: 'Total available cash',
    },
  ];

  if (isLoadingSingle || isLoadingRecurring || isLoadingGoals) {
    return (
      <div className="flex h-screen items-center justify-center">
        <Loader2 className="mr-2 h-8 w-8 animate-spin" />
        <p>Loading Dashboard...</p>
      </div>
    );
  }

  return (
    <div className="grid gap-6">
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {mainStats.map((stat) => (
          <Card key={stat.title}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">{stat.title}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stat.value}</div>
              <p className="text-xs text-muted-foreground">{stat.change}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-7">
        <Card className="lg:col-span-full xl:col-span-4">
          <CardHeader>
            <CardTitle>Overview</CardTitle>
          </CardHeader>
          <CardContent className="pl-2">
            <ChartContainer config={chartConfig} className="h-[300px] w-full">
              <ResponsiveContainer>
                <BarChart data={chartData}>
                  <CartesianGrid vertical={false} />
                  <XAxis
                    dataKey="month"
                    tickLine={false}
                    tickMargin={10}
                    axisLine={false}
                    stroke="#888888"
                    fontSize={12}
                  />
                  <YAxis tickFormatter={(val) => `₱${(val / 1000).toFixed(0)}k`}  stroke="#888888" fontSize={12}/>
                  <ChartTooltip content={<ChartTooltipContent />} />
                  <ChartLegend content={<ChartLegendContent />} />
                  <Bar dataKey="income" fill="var(--color-income)" radius={4} />
                  <Bar dataKey="expenses" fill="var(--color-expenses)" radius={4} />
                </BarChart>
              </ResponsiveContainer>
            </ChartContainer>
          </CardContent>
        </Card>

        <Card className="lg:col-span-full xl:col-span-3">
          <CardHeader>
            <CardTitle>Recent Transactions</CardTitle>
          </CardHeader>
          <CardContent>
            {recentTransactions && recentTransactions.length > 0 ? (
            <div className="space-y-4">
              {recentTransactions.map((transaction, index) => {
                const transactionDate = toDate(transaction.date);
                return (
                  <div key={transaction.id + '-' + index} className="flex items-center justify-between">
                    <div className="flex-1 pr-4">
                      <div className="font-medium truncate">{transaction.description}</div>
                      <div className="text-sm text-muted-foreground">
                        {transactionDate ? format(transactionDate, "MMM d, yyyy") : 'Invalid Date'}
                      </div>
                    </div>
                    <div className={cn("font-bold", transaction.category === "Income" ? "text-green-600" : "text-red-600")}>
                      {transaction.category === "Income" ? "+" : "-"}₱{transaction.amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </div>
                  </div>
                )
              })}
            </div>
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                <p>No transactions recorded yet.</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Financial Goals Progress</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {financialGoals && financialGoals.length > 0 ? (
            financialGoals.slice(0, 3).map((goal) => (
              <div key={goal.id}>
                <div className="flex justify-between mb-1">
                  <span className="text-sm font-medium">{goal.name}</span>
                  <span className="text-sm text-muted-foreground">
                    ₱{goal.currentAmount.toLocaleString()} / ₱{goal.targetAmount.toLocaleString()}
                  </span>
                </div>
                <Progress value={(goal.currentAmount / goal.targetAmount) * 100} />
              </div>
            ))
           ) : (
            <div className="text-center py-8 text-muted-foreground">
              <p>No financial goals set yet.</p>
            </div>
           )}
        </CardContent>
      </Card>
    </div>
  )
}
