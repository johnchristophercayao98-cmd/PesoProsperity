
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
import { format, addDays, addWeeks, addMonths, addYears, isBefore, startOfToday } from 'date-fns';
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
import { useLanguage } from '@/context/language-context';


const recurringSchema = z.object({
  description: z.string().min(2, "Description is required"),
  amount: z.coerce.number().min(0.01, 'Amount must be positive.'),
  category: z.enum(['Income', 'Expense']),
  subcategory: z.string().min(2, 'Subcategory is required.'),
  frequency: z.enum(['daily', 'weekly', 'monthly', 'yearly']),
  startDate: z.date({ required_error: 'Start date is required.' }),
  endDate: z.date().optional(),
  paymentMethod: z.string().min(2, 'Payment method is required.'),
});

type RecurringFormData = z.infer<typeof recurringSchema>;

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
    'Repairs and Maintenance',
    'Other',
];

export function RecurringList() {
  const { t } = useLanguage();
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
      category: 'Expense',
      frequency: 'monthly',
      description: '',
      subcategory: '',
      amount: 0,
      paymentMethod: '',
      startDate: new Date(),
      endDate: undefined,
    },
  });

  const category = form.watch('category');
  
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

  const getNextDueDate = (transaction: RecurringTransaction): Date | null => {
    const startDate = toDate(transaction.startDate);
    if (!startDate) return null;
  
    const tomorrow = addDays(startOfToday(), 1);
    let nextDate = startDate;
  
    const addInterval = (date: Date): Date => {
      switch (transaction.frequency) {
        case 'daily':
          return addDays(date, 1);
        case 'weekly':
          return addWeeks(date, 1);
        case 'monthly':
          return addMonths(date, 1);
        case 'yearly':
          return addYears(date, 1);
        default:
          return date;
      }
    };
  
    while (isBefore(nextDate, tomorrow)) {
      nextDate = addInterval(nextDate);
    }
  
    const endDate = toDate(transaction.endDate);
    if (endDate && isBefore(endDate, nextDate)) {
      return null; // Past end date
    }
  
    return nextDate;
  };

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

    if (editingTransaction) {
        const transRef = doc(firestore, 'users', user.uid, 'recurringTransactions', editingTransaction.id);
        updateDocumentNonBlocking(transRef, data);
        toast({
            title: "Transaction Updated!",
            description: `Recurring transaction "${data.description}" has been updated.`,
        });
    } else {
        addDocumentNonBlocking(collection(firestore, 'users', user.uid, 'recurringTransactions'), {
            ...data,
            userId: user.uid,
        });
        toast({
            title: 'Transaction Added!',
            description: `Recurring transaction "${data.description}" has been added.`,
        });
    }
    
    form.reset();
    handleDialogOpenChange(false);
  };

  return (
    <>
      <div className="mb-6 flex flex-col sm:flex-row items-stretch sm:items-center sm:justify-end gap-2">
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="outline" className='w-full sm:w-auto'>
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
            <Button className='w-full sm:w-auto'>
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
                id="recurring-form"
                onSubmit={form.handleSubmit(onSubmit)}
                className="space-y-4"
              >
                 <FormField
                    control={form.control}
                    name="description"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Description</FormLabel>
                        <FormControl>
                          <Input
                            placeholder="e.g., Office Rent, Client Retainer"
                            {...field}
                          />
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
                    name="category"
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
                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="startDate"
                    render={({ field }) => (
                      <FormItem className="flex flex-col">
                        <FormLabel>Start Date</FormLabel>
                        <DatePicker
                          date={field.value}
                          setDate={field.onChange}
                        />
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
                        <DatePicker
                          date={field.value}
                          setDate={field.onChange}
                        />
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              </form>
            </Form>
            <DialogFooter>
              <DialogClose asChild>
                <Button type="button" variant="secondary">
                  {t('cancel')}
                </Button>
              </DialogClose>
              <Button type="submit" form="recurring-form">Save Transaction</Button>
            </DialogFooter>
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
          <>
            <div className='hidden md:block'>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Description</TableHead>
                    <TableHead>Category</TableHead>
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
                    const nextDueDate = getNextDueDate(t);
                    return (
                    <TableRow key={t.id}>
                      <TableCell className="font-medium">{t.description}</TableCell>
                      <TableCell>
                        <Badge variant="outline">{t.subcategory}</Badge>
                      </TableCell>
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
                      <TableCell>{nextDueDate ? format(nextDueDate, 'MMM d, yyyy') : 'Ended'}</TableCell>
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
            </div>
            <div className="grid gap-4 md:hidden">
                {transactions && transactions.map((t) => {
                    const nextDueDate = getNextDueDate(t);
                    return (
                        <Card key={t.id} className="p-4 grid gap-2">
                            <div className="flex items-start justify-between">
                                <div className="font-medium">{t.description}</div>
                                <DropdownMenu>
                                    <DropdownMenuTrigger asChild>
                                        <Button variant="ghost" className="h-8 w-8 p-0 -mt-1">
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
                            </div>
                            <div className="flex items-center justify-between text-sm">
                                <div className='flex items-center gap-2'>
                                    <Badge variant="outline">{t.subcategory}</Badge>
                                    <Badge variant="secondary" className="capitalize">{t.frequency}</Badge>
                                </div>
                                <div className={cn("font-bold", t.category === 'Income' ? 'text-green-600' : 'text-red-600')}>
                                    {t.category === 'Income' ? '+' : '-'}₱{t.amount.toLocaleString()}
                                </div>
                            </div>
                            <div className="text-sm text-muted-foreground">
                                Next due: {nextDueDate ? format(nextDueDate, 'MMM d, yyyy') : 'Ended'}
                            </div>
                        </Card>
                    );
                })}
            </div>
          </>
          )}
        </CardContent>
      </Card>
    </>
  );
}
