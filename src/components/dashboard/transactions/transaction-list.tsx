
'use client';

import { useState, useMemo } from 'react';
import type { Transaction, RecurringTransaction } from '@/lib/types';
import {
  addDays,
  addWeeks,
  addMonths,
  addYears,
  isAfter,
  isBefore,
  isEqual,
  startOfDay,
} from 'date-fns';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { MoreHorizontal, PlusCircle, Loader2 } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogClose,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { DatePicker } from '@/components/ui/date-picker';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { useToast } from '@/hooks/use-toast';
import { Badge } from '@/components/ui/badge';
import {
  useFirestore,
  useUser,
  useCollection,
  useMemoFirebase,
  addDocumentNonBlocking,
  updateDocumentNonBlocking,
  deleteDocumentNonBlocking,
} from '@/firebase';
import { collection, doc, Timestamp, query } from 'firebase/firestore';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { useLanguage } from '@/context/language-context';

const transactionSchema = z.object({
  description: z.string().min(2, 'Description is required.'),
  amount: z.coerce.number().min(0.01, 'Amount must be positive.'),
  category: z.enum(['Income', 'Expense', 'Liability']),
  subcategory: z.string().min(2, 'Subcategory is required.'),
  date: z.date({ required_error: 'Date is required.' }),
  paymentMethod: z.string().min(2, 'Payment method is required.'),
});

type TransactionFormData = z.infer<typeof transactionSchema>;

const incomeCategories = [
  'Sales',
  'Services',
  'Interest Income',
  'Rental Income',
  'Other',
];

const expenseCategories = [
  'Cost of Goods Sold',
  'Salaries and Wages',
  'Rent',
  'Utilities',
  'Marketing and Advertising',
  'Office Supplies',
  'Taxes',
  'Loan',
  'Interest',
  'Repairs and Maintenance',
  'Other',
];

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
  recurringTxs: RecurringTransaction[]
): Transaction[] => {
  const instances: Transaction[] = [];
  const today = startOfDay(new Date());

  recurringTxs.forEach((rt) => {
    const startDate = toDate(rt.startDate);
    if (!startDate) return;

    let currentDate = startDate;
    const endDate = toDate(rt.endDate);

    while (isBefore(currentDate, today) || isEqual(currentDate, today)) {
      if (endDate && isAfter(currentDate, endDate)) {
        break;
      }

      instances.push({
        ...rt,
        id: `${rt.id}-${currentDate.toISOString()}`,
        date: currentDate,
        description: `${rt.description} (Recurring)`,
      });

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

export function TransactionList() {
  const { t } = useLanguage();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingTransaction, setEditingTransaction] = useState<Transaction | null>(null);
  const [transactionToDelete, setTransactionToDelete] = useState<Transaction | null>(null);
  const { toast } = useToast();
  const firestore = useFirestore();
  const { user } = useUser();

  const singleTransactionsQuery = useMemoFirebase(() => {
    if (!user) return null;
    return query(collection(firestore, 'users', user.uid, 'expenses'));
  }, [firestore, user]);

  const recurringTransactionsQuery = useMemoFirebase(() => {
    if (!user) return null;
    return query(collection(firestore, 'users', user.uid, 'recurringTransactions'));
  }, [firestore, user]);

  const { data: singleTransactions, isLoading: isLoadingSingle } = useCollection<Transaction>(singleTransactionsQuery);
  const { data: recurringTransactions, isLoading: isLoadingRecurring } = useCollection<RecurringTransaction>(recurringTransactionsQuery);

  const allTransactions = useMemo(() => {
    if (!singleTransactions || !recurringTransactions) return [];

    const recurringInstances = generateTransactionInstances(recurringTransactions);
    
    const combined = [...singleTransactions, ...recurringInstances];

    return combined.sort((a, b) => {
        const dateA = toDate(a.date)?.getTime() || 0;
        const dateB = toDate(b.date)?.getTime() || 0;
        return dateB - dateA;
    });
  }, [singleTransactions, recurringTransactions]);

  const isLoadingTransactions = isLoadingSingle || isLoadingRecurring;

  const form = useForm<TransactionFormData>({
    resolver: zodResolver(transactionSchema),
    defaultValues: {
      description: '',
      amount: 0,
      category: 'Expense',
      subcategory: '',
      date: new Date(),
      paymentMethod: '',
    }
  });

  const category = form.watch('category');

  const handleDialogOpenChange = (open: boolean) => {
    setIsDialogOpen(open);
    if (!open) {
      setEditingTransaction(null);
      form.reset();
    }
  };

  const handleEdit = (transaction: Transaction) => {
    // We can only edit non-recurring transactions through this UI
    if (transaction.description.includes('(Recurring)')) {
        toast({
            variant: "destructive",
            title: "Cannot Edit Recurring Transaction",
            description: "Please edit the recurring transaction from the Recurring Transactions page."
        })
        return;
    }
    setEditingTransaction(transaction);
    form.reset({
      ...transaction,
      date: toDate(transaction.date)!,
    });
    setIsDialogOpen(true);
  };

  const handleDelete = () => {
    if (!transactionToDelete || !user) return;
     // We can only delete non-recurring transactions through this UI
    if (transactionToDelete.description.includes('(Recurring)')) {
        toast({
            variant: "destructive",
            title: "Cannot Delete Recurring Transaction",
            description: "Please delete the recurring transaction from the Recurring Transactions page."
        })
        setTransactionToDelete(null);
        return;
    }
    const transactionRef = doc(firestore, 'users', user.uid, 'expenses', transactionToDelete.id);
    deleteDocumentNonBlocking(transactionRef);
    toast({
      title: 'Transaction Deleted!',
      description: 'The transaction has been removed.',
    });
    setTransactionToDelete(null);
  };

  const onSubmit = (data: TransactionFormData) => {
    if (!user) return;
    if (editingTransaction) {
      const transactionRef = doc(firestore, 'users', user.uid, 'expenses', editingTransaction.id);
      updateDocumentNonBlocking(transactionRef, data);
      toast({
        title: 'Transaction Updated!',
        description: `The transaction "${data.description}" has been updated.`,
      });
    } else {
      addDocumentNonBlocking(collection(firestore, 'users', user.uid, 'expenses'), {
        ...data,
        userId: user.uid,
      });
      toast({
        title: 'Transaction Added!',
        description: `The transaction "${data.description}" has been added.`,
      });
    }
    handleDialogOpenChange(false);
  };

  const dialogTitle = editingTransaction
    ? 'Edit Transaction'
    : 'Add New Transaction';
  const dialogDescription = editingTransaction
    ? 'Update the details of your transaction.'
    : 'Record a new income or expense.';

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
        {isLoadingTransactions ? (
            <div className="flex items-center justify-center p-8">
                <Loader2 className="mr-2 h-8 w-8 animate-spin" />
                <p>Loading transactions...</p>
            </div>
        ) : (
          <>
            <div className="hidden md:block">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Description</TableHead>
                    <TableHead>Category</TableHead>
                    <TableHead className="text-right">Amount</TableHead>
                    <TableHead>
                      <span className="sr-only">Actions</span>
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {allTransactions && allTransactions.map((t) => {
                    const transactionDate = toDate(t.date);
                    return (
                    <TableRow key={t.id}>
                      <TableCell>{transactionDate ? format(transactionDate, 'MMM d, yyyy') : 'Invalid Date'}</TableCell>
                      <TableCell className="font-medium">{t.description}</TableCell>
                      <TableCell>
                        <Badge variant="outline">{t.subcategory}</Badge>
                      </TableCell>
                      <TableCell
                        className={cn(
                          'text-right',
                          t.category === 'Income'
                            ? 'text-green-600'
                            : 'text-red-600'
                        )}
                      >
                        {t.category === 'Income' ? '+' : '-'}₱
                        {t.amount.toLocaleString(undefined, {
                          minimumFractionDigits: 2,
                          maximumFractionDigits: 2,
                        })}
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
                            <DropdownMenuItem onClick={() => handleEdit(t)}>
                              Edit
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() => setTransactionToDelete(t)}
                              className="text-destructive"
                            >
                              Delete
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  )})}
                </TableBody>
              </Table>
            </div>
            <div className="grid gap-4 md:hidden">
              {allTransactions.map(t => {
                const transactionDate = toDate(t.date);
                return (
                  <Card key={t.id} className="grid gap-2 p-4">
                    <div className="flex items-center justify-between">
                      <div className="font-medium">{t.description}</div>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" className="h-8 w-8 p-0">
                            <span className="sr-only">Open menu</span>
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => handleEdit(t)}>
                            Edit
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() => setTransactionToDelete(t)}
                            className="text-destructive"
                          >
                            Delete
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                    <div className="flex items-center justify-between text-sm">
                      <Badge variant="outline">{t.subcategory}</Badge>
                      <div className={cn(
                        'font-bold',
                        t.category === 'Income'
                          ? 'text-green-600'
                          : 'text-red-600'
                      )}>
                        {t.category === 'Income' ? '+' : '-'}₱
                        {t.amount.toLocaleString(undefined, {
                          minimumFractionDigits: 2,
                          maximumFractionDigits: 2,
                        })}
                      </div>
                    </div>
                    <div className="text-sm text-muted-foreground">
                      {transactionDate ? format(transactionDate, 'MMM d, yyyy') : 'Invalid Date'}
                    </div>
                  </Card>
                );
              })}
            </div>
          </>
          )}
        </CardContent>
      </Card>
      
      <AlertDialog open={!!transactionToDelete} onOpenChange={(open) => !open && setTransactionToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. This will permanently delete this transaction.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setTransactionToDelete(null)}>{t('cancel')}</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete}>Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog open={isDialogOpen} onOpenChange={handleDialogOpenChange}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{dialogTitle}</DialogTitle>
            <DialogDescription>{dialogDescription}</DialogDescription>
          </DialogHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} id="transaction-form" className="space-y-4">
              <FormField
                control={form.control}
                name="description"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Description</FormLabel>
                    <FormControl>
                      <Input placeholder="e.g., Product Sale" {...field} />
                    </FormControl>
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
                      <FormControl>
                        <Input type="number" placeholder="1999.00" {...field} />
                      </FormControl>
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
                      <Select
                        onValueChange={field.onChange}
                        value={field.value}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select type" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="Income">Income</SelectItem>
                          <SelectItem value="Expense">Expense</SelectItem>
                          <SelectItem value="Liability">Liability</SelectItem>
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
                      <Select
                        onValueChange={field.onChange}
                        value={field.value}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select a category" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {(category === 'Income'
                            ? incomeCategories
                            : expenseCategories
                          ).map((cat) => (
                            <SelectItem key={cat} value={cat}>
                              {cat}
                            </SelectItem>
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
                      <FormControl>
                        <DatePicker date={field.value} setDate={field.onChange} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              <FormField
                  control={form.control}
                  name="paymentMethod"
                  render={({ field }) => (
                      <FormItem>
                          <FormLabel>Payment Method</FormLabel>
                          <FormControl><Input placeholder="e.g., GCash" {...field} /></FormControl>
                          <FormMessage />
                      </FormItem>
                  )}
              />
            </form>
          </Form>
          <DialogFooter>
            <DialogClose asChild>
              <Button type="button" variant="secondary">
                {t('cancel')}
              </Button>
            </DialogClose>
            <Button type="submit" form="transaction-form">Save Transaction</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
