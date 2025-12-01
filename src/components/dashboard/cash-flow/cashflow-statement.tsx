
"use client"

import { useMemo } from "react";
import { format } from "date-fns";
import { DollarSign, Loader2, TrendingDown, TrendingUp } from "lucide-react";
import type { Transaction } from "@/lib/types";
import { useCollection, useFirestore, useMemoFirebase, useUser } from '@/firebase';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { collection, query, orderBy, Timestamp } from 'firebase/firestore';
import { cn } from "@/lib/utils";

const toDate = (date: any): Date | undefined => {
  if (!date) return undefined;
  if (date instanceof Date) return date;
  if (date instanceof Timestamp) return date.toDate();
  if (typeof date === 'string' || typeof date === 'number') return new Date(date);
  return undefined;
}

export function CashflowStatement() {
  const firestore = useFirestore();
  const { user } = useUser();
  
  const transactionsQuery = useMemoFirebase(() => {
    if (!user) return null;
    return query(collection(firestore, 'users', user.uid, 'expenses'), orderBy('date', 'asc'));
  }, [firestore, user]);

  const { data: transactions, isLoading: isLoadingTransactions } = useCollection<Transaction>(transactionsQuery);

  const { statementData, beginningBalance, totalInflows, totalOutflows } = useMemo(() => {
    if (!transactions) {
      return {
        statementData: [],
        beginningBalance: 0,
        totalInflows: 0,
        totalOutflows: 0,
      };
    }

    let runningBalance = 0;
    const statementEntries = transactions.map(t => {
      const inflow = t.category === 'Income' ? t.amount : 0;
      const outflow = t.category === 'Expense' ? t.amount : 0;
      const netChange = inflow - outflow;
      runningBalance += netChange;
      
      return {
        id: t.id,
        date: toDate(t.date),
        description: t.description,
        inflow,
        outflow,
        netChange,
        endingBalance: runningBalance,
      };
    });

    const totalInflows = statementEntries.reduce((sum, entry) => sum + entry.inflow, 0);
    const totalOutflows = statementEntries.reduce((sum, entry) => sum + entry.outflow, 0);

    return {
      statementData: statementEntries,
      beginningBalance: 0, // Assuming starting from zero
      totalInflows,
      totalOutflows
    };

  }, [transactions]);


  if (isLoadingTransactions) {
    return (
      <div className="flex items-center justify-center p-8">
          <Loader2 className="mr-2 h-8 w-8 animate-spin" />
          <p>Loading statement data...</p>
      </div>
    )
  }

  return (
    <div className="grid gap-6">
      <div className="grid md:grid-cols-3 gap-6">
          <Card>
            <CardHeader className="flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium">Beginning Cash Balance</CardTitle>
                <DollarSign className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
                <div className="text-2xl font-bold">₱{beginningBalance.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
                <p className="text-xs text-muted-foreground">Starting balance for the period</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium">Total Cash Inflows</CardTitle>
                <TrendingUp className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
                <div className="text-2xl font-bold text-green-600">+₱{totalInflows.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
                <p className="text-xs text-muted-foreground">Total income received</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium">Total Cash Outflows</CardTitle>
                <TrendingDown className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
                <div className="text-2xl font-bold text-red-600">-₱{totalOutflows.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
                <p className="text-xs text-muted-foreground">Total expenses paid</p>
            </CardContent>
          </Card>
      </div>
       <Card>
        <CardHeader>
          <CardTitle>Direct Cash Flow</CardTitle>
          <CardDescription>A detailed log of all cash movements and the running balance.</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Description</TableHead>
                <TableHead className="text-right">Cash In</TableHead>
                <TableHead className="text-right">Cash Out</TableHead>
                <TableHead className="text-right">Net Change</TableHead>
                <TableHead className="text-right">Ending Balance</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {statementData.map((entry) => (
                <TableRow key={entry.id}>
                  <TableCell>{entry.date ? format(entry.date, "MMM d, yyyy") : 'N/A'}</TableCell>
                  <TableCell className="font-medium">{entry.description}</TableCell>
                  <TableCell className="text-right text-green-600">
                    {entry.inflow > 0 ? `+₱${entry.inflow.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : '-'}
                  </TableCell>
                  <TableCell className="text-right text-red-600">
                    {entry.outflow > 0 ? `-₱${entry.outflow.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : '-'}
                  </TableCell>
                  <TableCell className={cn("text-right font-medium", entry.netChange > 0 ? 'text-green-600' : 'text-red-600')}>
                     {entry.netChange > 0 ? '+' : ''}₱{entry.netChange.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </TableCell>
                  <TableCell className="text-right font-bold">
                    ₱{entry.endingBalance.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          {statementData.length === 0 && !isLoadingTransactions && (
            <div className="text-center p-8 text-muted-foreground">
              No transactions found to build the cash flow statement.
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
