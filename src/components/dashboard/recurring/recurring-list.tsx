'use client';

import { useState, useMemo } from 'react';
import type { RecurringTransaction } from '@/lib/types';
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
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  MoreHorizontal,
  PlusCircle,
  Calendar as CalendarIcon,
  Loader2,
} from 'lucide-react';
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
  DialogTrigger,
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
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import {
  useFirestore,
  useUser,
  useCollection,
  useMemoFirebase,
  addDocumentNonBlocking,
  updateDocumentNonBlocking,
  deleteDocumentNonBlocking,
} from '@/firebase';
import { collection, doc, query, Timestamp } from 'firebase/firestore';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';


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
  'Software and Subscriptions',
  'Taxes',
  'Travel',
  'Repairs and Maintenance',
  'Other',
];

const recurringSchema = z.object({
  category: z.string().min(3, 'Category is required.'),
  amount: z.coerce.number().min(0.01, 'Amount must be positive.'),
  type: z.enum(['Income', 'Expense']),
  frequency: z.enum(['daily', 'weekly', 'monthly', 'yearly']),
  startDate: z.date({ required_error: 'Start date is required.' }),
  endDate: z.date().optional(),
  paymentMethod: z.string().min(2, 'Payment method is required.'),
  description: z.string().min(2, "Description is required"),
});

type RecurringFormData = z.infer<typeof recurringSchema>;

export function RecurringList() {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [editingTransaction, setEditingTransaction] = useState<RecurringTransaction | null>(null);
  const [transactionToDelete, setTransactionToDelete] = useState<RecurringTransaction | null>(null);

  const { toast } = useToast();
  const firestore = useFirestore();
  const { user } = useUser();

  const transactionsQuery = useMemoFirebase(() => {
    if (!user) return null;
    // This query is simplified, a more complex query would be needed to filter by active date ranges
    // For now, we fetch all and filter on the client
    return query(
      collection(firestore, 'users', user.uid, 'recurringTransactions')
    );
  }, [firestore, user]);

  const { data: transactions, isLoading: isLoadingTransactions } = useCollection<RecurringTransaction>(transactionsQuery);

  const form = useForm<RecurringFormData>({
    resolver: zodResolver(recurringSchema),
    defaultValues: {
      type: 'Expense',
      frequency: 'monthly',
      category: '',
      amount: 0,
      paymentMethod: '',
      startDate: new Date(),
      endDate: undefined,
      description: '',
    },
  });

  const type = form.watch('type');
  
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
  }

  const handleDialogOpenChange = (open: boolean) => {
    setIsDialogOpen(open);
    if (!open) {
      setEditingTransaction(null);
      form.reset();
    }
  };

  const handleEdit = (transaction: RecurringTransaction) => {
    setEditingTransaction(transaction);
    form.reset({
      ...transaction,
      type: transaction.category,
      startDate: toDate(transaction.startDate)!,
      endDate: toDate(transaction.endDate),
    });
    setIsDialogOpen(true);
  };
  
  const handleDelete = () => {
    if(!transactionToDelete || !user) return;
    const transRef = doc(firestore, 'users', user.uid, 'recurringTransactions', transactionToDelete.id);
    deleteDocumentNonBlocking(transRef);
    toast({
        title: "Recurring Transaction Deleted",
        description: "The transaction has been removed."
    })
    setTransactionToDelete(null);
  }

  const onSubmit = (data: RecurringFormData) => {
    if (!user) return;

    const submissionData = {
        ...data,
        category: data.type, // Map 'type' back to 'category' for Firestore
        description: data.category
    };

    if (editingTransaction) {
        const transRef = doc(firestore, 'users', user.uid, 'recurringTransactions', editingTransaction.id);
        updateDocumentNonBlocking(transRef, submissionData);
        toast({
            title: "Transaction Updated!",
            description: `Recurring transaction "${data.category}" has been updated.`,
        });
    } else {
        addDocumentNonBlocking(collection(firestore, 'users', user.uid, 'recurringTransactions'), {
            ...submissionData,
            userId: user.uid,
        });
        toast({
            title: 'Transaction Added!',
            description: `Recurring transaction "${data.category}" has been added.`,
        });
    }
    
    form.reset();
    handleDialogOpenChange(false);
  };

  return (
    <>
      <div className="mb-6 flex items-center justify-end gap-2">
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="outline">
              <CalendarIcon className="mr-2 h-4 w-4" />
              {format(selectedDate, 'MMMM yyyy')}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0">
            <Calendar
              mode="single"
              selected={selectedDate}
              onSelect={(date) => {
                if (date) setSelectedDate(date);
              }}
              initialFocus
              captionLayout="dropdown-buttons"
              fromYear={2020}
              toYear={2030}
            />
          </PopoverContent>
        </Popover>
        <Dialog open={isDialogOpen} onOpenChange={handleDialogOpenChange}>
          <DialogTrigger asChild>
            <Button>
              <PlusCircle className="mr-2 h-4 w-4" />
              Add Recurring
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>{editingTransaction ? 'Edit' : 'Add'} Recurring Transaction</DialogTitle>
              <DialogDescription>
                Set up a new automatic transaction.
              </DialogDescription>
            </DialogHeader>
            <Form {...form}>
              <form
                onSubmit={form.handleSubmit(onSubmit)}
                className="space-y-4"
              >
                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="type"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Type</FormLabel>
                        <Select
                          onValueChange={field.onChange}
                          defaultValue={field.value}
                        >
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Select type" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="Income">Income</SelectItem>
                            <SelectItem value="Expense">Expense</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="category"
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
                            {(type === 'Income'
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
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="amount"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Amount (₱)</FormLabel>
                        <FormControl>
                          <Input
                            type="number"
                            placeholder="25000"
                            {...field}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="frequency"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Frequency</FormLabel>
                        <Select
                          onValueChange={field.onChange}
                          defaultValue={field.value}
                        >
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Select frequency" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="daily">Daily</SelectItem>
                            <SelectItem value="weekly">Weekly</SelectItem>
                            <SelectItem value="monthly">Monthly</SelectItem>
                            <SelectItem value="yearly">Yearly</SelectItem>
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
                    name="startDate"
                    render={({ field }) => (
                      <FormItem className="flex flex-col">
                        <FormLabel>Start Date</FormLabel>
                        <FormControl>
                          <DatePicker
                            date={field.value}
                            setDate={field.onChange}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="endDate"
                    render={({ field }) => (
                      <FormItem className="flex flex-col">
                        <FormLabel>End Date (Optional)</FormLabel>
                        <FormControl>
                          <DatePicker
                            date={field.value}
                            setDate={field.onChange}
                          />
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
                      <FormControl>
                        <Input
                          placeholder="e.g., Bank Transfer"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <DialogFooter>
                  <DialogClose asChild>
                    <Button type="button" variant="secondary">
                      Cancel
                    </Button>
                  </DialogClose>
                  <Button type="submit">Save Transaction</Button>
                </DialogFooter>
              </form>
            </Form>
          </DialogContent>
        </Dialog>
      </div>

       <AlertDialog open={!!transactionToDelete} onOpenChange={(open) => !open && setTransactionToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This action will permanently delete the recurring transaction "{transactionToDelete?.description}".
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setTransactionToDelete(null)}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete}>Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Card>
        <CardHeader>
          <CardTitle>
            Scheduled Transactions for {format(selectedDate, 'MMMM yyyy')}
          </CardTitle>
        </CardHeader>
        <CardContent>
        {isLoadingTransactions ? (
            <div className="flex items-center justify-center p-8">
                <Loader2 className="mr-2 h-8 w-8 animate-spin" />
                <p>Loading transactions...</p>
            </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Description</TableHead>
                <TableHead>Amount</TableHead>
                <TableHead>Frequency</TableHead>
                <TableHead>Next Due</TableHead>
                <TableHead>
                  <span className="sr-only">Actions</span>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {transactions && transactions.map((t) => {
                const startDate = toDate(t.startDate);
                return (
                <TableRow key={t.id}>
                  <TableCell className="font-medium">{t.description}</TableCell>
                  <TableCell
                    className={cn(
                      t.category === 'Income'
                        ? 'text-green-600'
                        : 'text-red-600'
                    )}
                  >
                    {t.category === 'Income' ? '+' : '-'}₱
                    {t.amount.toLocaleString()}
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className="capitalize">
                      {t.frequency}
                    </Badge>
                  </TableCell>
                  <TableCell>{startDate ? format(startDate, 'MMM d, yyyy') : 'Invalid Date'}</TableCell>
                  <TableCell>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" className="h-8 w-8 p-0">
                          <span className="sr-only">Open menu</span>
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => handleEdit(t)}>Edit</DropdownMenuItem>
                        <DropdownMenuItem>Pause</DropdownMenuItem>
                        <DropdownMenuItem className="text-destructive" onClick={() => setTransactionToDelete(t)}>
                          Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              )})}
            </TableBody>
          </Table>
          )}
        </CardContent>
      </Card>
    </>
  );
}
