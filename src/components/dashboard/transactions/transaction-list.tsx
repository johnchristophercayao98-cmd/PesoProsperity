"use client"

import { useState } from "react";
import { recentTransactions as initialData } from "@/lib/data";
import type { Transaction } from "@/lib/types";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { MoreHorizontal, PlusCircle } from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
  DialogClose,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DatePicker } from "@/components/ui/date-picker";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { useToast } from "@/hooks/use-toast";
import { Badge } from "@/components/ui/badge";

const transactionSchema = z.object({
    description: z.string().min(2, "Description is required."),
    amount: z.coerce.number().min(0.01, "Amount must be positive."),
    category: z.enum(["Income", "Expense"]),
    subcategory: z.string().min(2, "Subcategory is required."),
    date: z.date({ required_error: "Date is required." }),
});

type TransactionFormData = z.infer<typeof transactionSchema>;

const incomeCategories = [
    "Sales",
    "Services",
    "Interest Income",
    "Rental Income",
    "Other",
];

const expenseCategories = [
    "Cost of Goods Sold",
    "Salaries and Wages",
    "Rent",
    "Utilities",
    "Marketing and Advertising",
    "Office Supplies",
    "Software and Subscriptions",
    "Taxes",
    "Travel",
    "Repairs and Maintenance",
    "Other",
];


export function TransactionList() {
    const [transactions, setTransactions] = useState<Transaction[]>(initialData);
    const [isDialogOpen, setIsDialogOpen] = useState(false);
    const [editingTransaction, setEditingTransaction] = useState<Transaction | null>(null);
    const { toast } = useToast();

    const form = useForm<TransactionFormData>({
      resolver: zodResolver(transactionSchema),
    });

    const category = form.watch("category");

    const handleDialogOpenChange = (open: boolean) => {
        setIsDialogOpen(open);
        if (!open) {
            setEditingTransaction(null);
            form.reset();
        }
    };

    const handleEdit = (transaction: Transaction) => {
        setEditingTransaction(transaction);
        form.reset({
            ...transaction,
            date: new Date(transaction.date)
        });
        setIsDialogOpen(true);
    };

    const handleDelete = (id: string) => {
        setTransactions(transactions.filter(t => t.id !== id));
        toast({
            title: "Transaction Deleted!",
            description: "The transaction has been removed.",
        });
    };
    
    const onSubmit = (data: TransactionFormData) => {
        if (editingTransaction) {
            const updatedTransaction: Transaction = { ...editingTransaction, ...data };
            setTransactions(transactions.map(t => t.id === editingTransaction.id ? updatedTransaction : t));
            toast({ title: "Transaction Updated!", description: `The transaction "${data.description}" has been updated.` });
        } else {
            const newTransaction: Transaction = {
                id: (transactions.length + 1).toString(),
                ...data,
            };
            setTransactions(prev => [newTransaction, ...prev]);
            toast({ title: "Transaction Added!", description: `The transaction "${data.description}" has been added.` });
        }
        handleDialogOpenChange(false);
    };

    const dialogTitle = editingTransaction ? "Edit Transaction" : "Add New Transaction";
    const dialogDescription = editingTransaction ? "Update the details of your transaction." : "Record a new income or expense.";

    return (
        <>
            <div className="mb-6 flex justify-end">
                <Button onClick={() => handleDialogOpenChange(true)}>
                    <PlusCircle className="mr-2 h-4 w-4" />
                    Add Transaction
                </Button>
            </div>
            <Card>
                <CardHeader>
                    <CardTitle>All Transactions</CardTitle>
                </CardHeader>
                <CardContent>
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Date</TableHead>
                                <TableHead>Description</TableHead>
                                <TableHead>Category</TableHead>
                                <TableHead className="text-right">Amount</TableHead>
                                <TableHead><span className="sr-only">Actions</span></TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {transactions.map(t => (
                                <TableRow key={t.id}>
                                    <TableCell>{format(t.date, 'MMM d, yyyy')}</TableCell>
                                    <TableCell className="font-medium">{t.description}</TableCell>
                                    <TableCell><Badge variant="outline">{t.subcategory}</Badge></TableCell>
                                    <TableCell className={cn("text-right", t.category === 'Income' ? 'text-green-600' : 'text-red-600')}>
                                        {t.category === 'Income' ? '+' : '-'}₱{t.amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                    </TableCell>
                                    <TableCell className="text-right">
                                        <DropdownMenu>
                                            <DropdownMenuTrigger asChild>
                                                <Button variant="ghost" className="h-8 w-8 p-0">
                                                    <span className="sr-only">Open menu</span>
                                                    <MoreHorizontal className="h-4 w-4" />
                                                </Button>
                                            </DropdownMenuTrigger>
                                            <DropdownMenuContent align="end">
                                                <DropdownMenuItem onClick={() => handleEdit(t)}>Edit</DropdownMenuItem>
                                                <DropdownMenuItem onClick={() => handleDelete(t.id)} className="text-destructive">Delete</DropdownMenuItem>
                                            </DropdownMenuContent>
                                        </DropdownMenu>
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </CardContent>
            </Card>

            <Dialog open={isDialogOpen} onOpenChange={handleDialogOpenChange}>
                <DialogContent className="sm:max-w-md">
                    <DialogHeader>
                        <DialogTitle>{dialogTitle}</DialogTitle>
                        <DialogDescription>{dialogDescription}</DialogDescription>
                    </DialogHeader>
                    <Form {...form}>
                        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                           <FormField
                                control={form.control}
                                name="description"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Description</FormLabel>
                                        <FormControl><Input placeholder="e.g., Product Sale" {...field} /></FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                           <div className="grid grid-cols-2 gap-4">
                               <FormField
                                    control={form.control}
                                    name="amount"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>Amount (₱)</FormLabel>
                                            <FormControl><Input type="number" placeholder="1999.00" {...field} /></FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />
                                <FormField
                                    control={form.control}
                                    name="category"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>Type</FormLabel>
                                            <Select onValueChange={field.onChange} value={field.value}>
                                              <FormControl><SelectTrigger><SelectValue placeholder="Select type" /></SelectTrigger></FormControl>
                                              <SelectContent>
                                                  <SelectItem value="Income">Income</SelectItem>
                                                  <SelectItem value="Expense">Expense</SelectItem>
                                              </SelectContent>
                                            </Select>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />
                           </div>
                           <div className="grid grid-cols-2 gap-4">
                               <FormField
                                    control={form.control}
                                    name="subcategory"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>Category</FormLabel>
                                            <Select onValueChange={field.onChange} value={field.value}>
                                                <FormControl><SelectTrigger><SelectValue placeholder="Select a category" /></SelectTrigger></FormControl>
                                                <SelectContent>
                                                    {(category === 'Income' ? incomeCategories : expenseCategories).map(cat => (
                                                        <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                                                    ))}
                                                </SelectContent>
                                            </Select>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />
                                <FormField
                                    control={form.control}
                                    name="date"
                                    render={({ field }) => (
                                        <FormItem className="flex flex-col">
                                            <FormLabel>Date</FormLabel>
                                            <FormControl><DatePicker date={field.value} setDate={field.onChange} /></FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />
                           </div>
                            <DialogFooter>
                                <DialogClose asChild><Button type="button" variant="secondary">Cancel</Button></DialogClose>
                                <Button type="submit">Save Transaction</Button>
                            </DialogFooter>
                        </form>
                    </Form>
                </DialogContent>
            </Dialog>
        </>
    )
}
