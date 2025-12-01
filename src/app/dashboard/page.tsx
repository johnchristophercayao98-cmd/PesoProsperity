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
import { format, startOfMonth, endOfMonth, subMonths, isWithinInterval } from "date-fns"
import { useUser, useFirestore, useCollection, useMemoFirebase } from "@/firebase"
import { collection, query, orderBy, limit, Timestamp } from "firebase/firestore"
import type { Transaction, FinancialGoal } from "@/lib/types"
import { Loader2 } from "lucide-react"

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


export default function DashboardPage() {
  const { user } = useUser();
  const firestore = useFirestore();

  const transactionsQuery = useMemoFirebase(() => {
    if (!user) return null;
    return query(collection(firestore, 'users', user.uid, 'expenses'), orderBy('date', 'desc'));
  }, [firestore, user]);

  const goalsQuery = useMemoFirebase(() => {
    if (!user) return null;
    return query(collection(firestore, 'users', user.uid, 'financialGoals'));
  }, [firestore, user]);

  const { data: transactions, isLoading: isLoadingTransactions } = useCollection<Transaction>(transactionsQuery);
  const { data: financialGoals, isLoading: isLoadingGoals } = useCollection<FinancialGoal>(goalsQuery);

  const {
    netRevenue,
    totalExpenses,
    profitMargin,
    cashReserve,
    chartData,
    recentTransactions
  } = useMemo(() => {
    if (!transactions) {
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
    const currentMonthStart = startOfMonth(now);
    const currentMonthEnd = endOfMonth(now);
    
    let netRevenue = 0;
    let totalExpenses = 0;
    let cashReserve = 0;

    transactions.forEach(t => {
      const transactionDate = toDate(t.date);
      if (!transactionDate) return;

      if (isWithinInterval(transactionDate, { start: currentMonthStart, end: currentMonthEnd })) {
        if (t.category === 'Income') {
          netRevenue += t.amount;
        } else {
          totalExpenses += t.amount;
        }
      }

      if (t.category === 'Income') {
        cashReserve += t.amount;
      } else {
        cashReserve -= t.amount;
      }
    });

    const profitMargin = netRevenue > 0 ? ((netRevenue - totalExpenses) / netRevenue) * 100 : 0;
    
    const chartData = Array.from({ length: 6 }).map((_, i) => {
      const date = subMonths(now, 5 - i);
      const monthStart = startOfMonth(date);
      const monthEnd = endOfMonth(date);
      
      const monthTransactions = transactions.filter(t => {
        const transactionDate = toDate(t.date);
        return transactionDate && isWithinInterval(transactionDate, { start: monthStart, end: monthEnd });
      });

      const income = monthTransactions.filter(t => t.category === 'Income').reduce((sum, t) => sum + t.amount, 0);
      const expenses = monthTransactions.filter(t => t.category === 'Expense').reduce((sum, t) => sum + t.amount, 0);

      return { month: format(date, 'MMM'), income, expenses };
    });

    const recentTransactions = transactions.slice(0, 5);

    return { netRevenue, totalExpenses, profitMargin, cashReserve, chartData, recentTransactions };

  }, [transactions]);
  
  const mainStats = [
    {
      title: 'Net Revenue',
      value: `₱${netRevenue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
      change: 'in ' + format(new Date(), 'MMMM'),
    },
    {
      title: 'Total Expenses',
      value: `₱${totalExpenses.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
      change: 'in ' + format(new Date(), 'MMMM'),
    },
    {
      title: 'Profit Margin',
      value: `${profitMargin.toFixed(1)}%`,
      change: 'in ' + format(new Date(), 'MMMM'),
    },
    {
      title: 'Cash Reserve',
      value: `₱${cashReserve.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
      change: 'Total available cash',
    },
  ];

  if (isLoadingTransactions || isLoadingGoals) {
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

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-7">
        <Card className="lg:col-span-4">
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
                  />
                  <YAxis tickFormatter={(val) => `₱${(val / 1000).toFixed(0)}k`} />
                  <ChartTooltip content={<ChartTooltipContent />} />
                  <ChartLegend content={<ChartLegendContent />} />
                  <Bar dataKey="income" fill="var(--color-income)" radius={4} />
                  <Bar dataKey="expenses" fill="var(--color-expenses)" radius={4} />
                </BarChart>
              </ResponsiveContainer>
            </ChartContainer>
          </CardContent>
        </Card>

        <Card className="lg:col-span-3">
          <CardHeader>
            <CardTitle>Recent Transactions</CardTitle>
          </CardHeader>
          <CardContent>
            {recentTransactions && recentTransactions.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Description</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {recentTransactions.map((transaction) => {
                  const transactionDate = toDate(transaction.date);
                  return (
                  <TableRow key={transaction.id}>
                    <TableCell>
                      <div className="font-medium">{transaction.description}</div>
                      <div className="text-sm text-muted-foreground">
                        {transactionDate ? format(transactionDate, "MMM d, yyyy") : 'Invalid Date'}
                      </div>
                    </TableCell>
                    <TableCell className={cn("text-right", transaction.category === "Income" ? "text-green-600" : "text-red-600")}>
                      {transaction.category === "Income" ? "+" : "-"}₱{transaction.amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </TableCell>
                  </TableRow>
                )})}
              </TableBody>
            </Table>
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
