
'use client';

import { useState, useMemo, useEffect } from 'react';
import {
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  Badge,
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogClose,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Popover,
  PopoverContent,
  PopoverTrigger,
  Calendar,
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
  Input,
} from '@/components/ui';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { ResponsiveContainer, Pie, PieChart, Cell } from 'recharts';
import { useToast } from '@/hooks/use-toast';
import {
  Loader2,
  PlusCircle,
  Calendar as CalendarIcon,
  MoreVertical,
} from 'lucide-react';
import type { Budget, BudgetCategory } from '@/lib/types';
import type { Transaction, RecurringTransaction } from '@/lib/types';
import {
  format,
  startOfMonth,
  endOfMonth,
  isWithinInterval,
  addDays,
  addWeeks,
  addMonths,
  addYears,
  isAfter,
  isBefore,
  isEqual,
  startOfDay,
} from 'date-fns';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import {
  useFirestore,
  useUser,
  useCollection,
  useMemoFirebase,
  addDocumentNonBlocking,
  updateDocumentNonBlocking,
  deleteDocumentNonBlocking,
} from '@/firebase';
import { collection, query, where, doc, Timestamp } from 'firebase/firestore';
import { useLanguage } from '@/context/language-context';

const COLORS = [
  'hsl(var(--chart-1))',
  'hsl(var(--chart-2))',
  'hsl(var(--chart-3))',
  'hsl(var(--chart-4))',
  'hsl(var(--chart-5))',
];

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

const budgetItemSchema = z.object({
  id: z.string().optional(),
  type: z.enum(['income', 'expense', 'liability']),
  category: z.string().min(2, 'Category is required.'),
  budgeted: z.coerce
    .number()
    .min(0, 'Budgeted amount must be a positive number.'),
});

type BudgetItemFormData = z.infer<typeof budgetItemSchema>;

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
  const today = startOfDay(new Date());

  recurringTxs.forEach((rt) => {
    const startDate = toDate(rt.startDate);
    if (!startDate) return;

    let currentDate = startDate;
    const endDate = toDate(rt.endDate);

    const generationEndDate = isBefore(periodEnd, today) ? periodEnd : today;

    while (
      isBefore(currentDate, generationEndDate) ||
      isEqual(currentDate, generationEndDate)
    ) {
      if (endDate && isAfter(currentDate, endDate)) {
        break;
      }

      if (
        isWithinInterval(currentDate, {
          start: periodStart,
          end: generationEndDate,
        })
      ) {
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

export function BudgetTabs() {
  const { t } = useLanguage();
  const { toast } = useToast();
  const [isAddBudgetItemDialogOpen, setIsAddBudgetItemDialogOpen] =
    useState(false);
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [itemToDelete, setItemToDelete] = useState<{
    docId: string;
    name: string;
  } | null>(null);
  const [editingBudgetItem, setEditingBudgetItem] = useState<{
    item: BudgetCategory;
    type: 'income' | 'expense' | 'liability';
  } | null>(null);

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

  const { data: budgets, isLoading: isBudgetsLoading } =
    useCollection<Budget>(budgetsQuery);

  const singleTransactionsQuery = useMemoFirebase(() => {
    if (!user) return null;
    return collection(firestore, 'users', user.uid, 'expenses');
  }, [firestore, user]);

  const recurringTransactionsQuery = useMemoFirebase(() => {
    if (!user) return null;
    return collection(firestore, 'users', user.uid, 'recurringTransactions');
  }, [firestore, user]);

  const {
    data: singleTransactions,
    isLoading: isSingleTransactionsLoading,
  } = useCollection<Transaction>(singleTransactionsQuery);
  const {
    data: recurringTransactions,
    isLoading: isRecurringTransactionsLoading,
  } = useCollection<RecurringTransaction>(recurringTransactionsQuery);

  const budget = useMemo(() => {
    const baseBudget = budgets?.[0] ?? null;
    if (!baseBudget) return null;

    const monthStart = startOfMonth(selectedDate);
    const monthEnd = endOfMonth(selectedDate);

    const recurringInstances = generateTransactionInstances(
      recurringTransactions || [],
      monthStart,
      monthEnd
    );
    const allTransactions = [
      ...(singleTransactions || []),
      ...recurringInstances,
    ];

    const monthlyTransactions = allTransactions.filter((t) => {
      const transactionDate = toDate(t.date);
      return (
        transactionDate &&
        isWithinInterval(transactionDate, { start: monthStart, end: monthEnd })
      );
    });

    const calculateActuals = (
      categories: any[],
      type: 'Income' | 'Expense' | 'Liability'
    ) => {
      return categories.map((category) => {
        const actual = monthlyTransactions
          .filter(
            (t) => {
              if (type === 'Income') return t.category === 'Income' && t.subcategory === category.name;
              return (t.category === 'Expense' || t.category === 'Liability') && t.subcategory === category.name
            }
          )
          .reduce((sum, t) => sum + t.amount, 0);
        return { ...category, actual };
      });
    };

    return {
      ...baseBudget,
      income: calculateActuals(baseBudget.income || [], 'Income'),
      expenses: calculateActuals(baseBudget.expenses || [], 'Expense'),
      liabilities: calculateActuals(baseBudget.liabilities || [], 'Liability'),
    };
  }, [budgets, singleTransactions, recurringTransactions, selectedDate]);

  const budgetItemForm = useForm<BudgetItemFormData>({
    resolver: zodResolver(budgetItemSchema),
    defaultValues: {
      type: 'expense',
      category: '',
      budgeted: 0,
    },
  });
  const itemType = budgetItemForm.watch('type');

  useEffect(() => {
    if (editingBudgetItem) {
      budgetItemForm.reset({
        type: editingBudgetItem.type,
        category: editingBudgetItem.item.name,
        budgeted: editingBudgetItem.item.budgeted,
      });
    } else {
      budgetItemForm.reset({
        type: 'expense',
        category: '',
        budgeted: 0,
      });
    }
  }, [editingBudgetItem, budgetItemForm]);

  const handleDialogOpenChange = (open: boolean) => {
    setIsAddBudgetItemDialogOpen(open);
    if (!open) {
      setEditingBudgetItem(null);
    }
  };

  const handleAddBudgetItem = async (data: BudgetItemFormData) => {
    if (!user || !firestore) return;

    if (budget && editingBudgetItem) {
      // Editing existing item
      const updatedCategories = (budget[editingBudgetItem.type] || []).map(
        (cat) => {
          if (cat.name === editingBudgetItem.item.name) {
            return { ...cat, name: data.category, budgeted: data.budgeted };
          }
          return cat;
        }
      );

      const updatePayload = {
        ...budget,
        [editingBudgetItem.type]: updatedCategories,
      };

      const budgetRef = doc(
        firestore,
        'users',
        user.uid,
        'budgets',
        budget.id
      );
      updateDocumentNonBlocking(budgetRef, {
        income: updatePayload.income.map(({ actual, ...rest }) => rest), // Don't save actual
        expenses: updatePayload.expenses.map(({ actual, ...rest }) => rest),
        liabilities: updatePayload.liabilities.map(({ actual, ...rest }) => rest),
      });

      toast({
        title: 'Budget Item Updated!',
        description: `${data.category} has been updated.`,
      });
    } else {
      // Adding new item
      const newCategory = {
        name: data.category,
        budgeted: data.budgeted,
      };

      if (budget) {
        let updatedIncome = budget?.income
          ? [...budget.income.map(({ actual, ...rest }) => rest)]
          : [];
        let updatedExpenses = budget?.expenses
          ? [...budget.expenses.map(({ actual, ...rest }) => rest)]
          : [];
        let updatedLiabilities = budget?.liabilities
          ? [...budget.liabilities.map(({ actual, ...rest }) => rest)]
          : [];

        if (data.type === 'income') {
          updatedIncome.push(newCategory);
        } else if (data.type === 'expense') {
          updatedExpenses.push(newCategory);
        } else { // liability
          updatedLiabilities.push(newCategory);
        }
        
        const budgetRef = doc(
          firestore,
          'users',
          user.uid,
          'budgets',
          budget.id
        );
        updateDocumentNonBlocking(budgetRef, {
          income: updatedIncome,
          expenses: updatedExpenses,
          liabilities: updatedLiabilities,
        });
      } else {
        const budgetCollRef = collection(
          firestore,
          'users',
          user.uid,
          'budgets'
        );
        addDocumentNonBlocking(budgetCollRef, {
          userId: user.uid,
          name: `${format(selectedDate, 'MMMM yyyy')} Budget`,
          startDate: startOfMonth(selectedDate),
          endDate: endOfMonth(selectedDate),
          income: data.type === 'income' ? [newCategory] : [],
          expenses: data.type === 'expense' ? [newCategory] : [],
          liabilities: data.type === 'liability' ? [newCategory] : [],
        });
      }
      toast({
        title: 'Budget Item Added!',
        description: `${data.category} has been added to your budget for ${format(
          selectedDate,
          'MMMM yyyy'
        )}.`,
      });
    }

    budgetItemForm.reset();
    handleDialogOpenChange(false);
  };

  const handleDeleteItem = () => {
    if (!itemToDelete || !budget || !user) return;

    const updatedIncome = budget.income.filter(
      (i) => i.name !== itemToDelete.name
    );
    const updatedExpenses = budget.expenses.filter(
      (e) => e.name !== itemToDelete.name
    );
    const updatedLiabilities = budget.liabilities.filter(
      (l) => l.name !== itemToDelete.name
    );

    const budgetRef = doc(firestore, 'users', user.uid, 'budgets', budget.id);
    updateDocumentNonBlocking(budgetRef, {
      income: updatedIncome.map(({ actual, ...rest }) => rest),
      expenses: updatedExpenses.map(({ actual, ...rest }) => rest),
      liabilities: updatedLiabilities.map(({ actual, ...rest }) => rest),
    });

    toast({
      title: 'Item Deleted',
      description: `The item "${itemToDelete.name}" has been removed from your budget.`,
    });
    setItemToDelete(null);
  };

  const renderBudgetTable = (
    title: string,
    data: any[],
    type: 'income' | 'expense' | 'liability'
  ) => (
    <div className="mb-4">
      <h3 className="text-lg font-semibold mb-2">{title}</h3>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Category</TableHead>
            <TableHead className="text-right">Budgeted</TableHead>
            <TableHead className="text-right">Actual</TableHead>
            <TableHead className="text-right">Variance</TableHead>
            <TableHead className="w-[50px]">
              <span className="sr-only">Actions</span>
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {data.map((item) => {
            const variance = type === 'income' ? item.actual - item.budgeted : item.budgeted - item.actual;
            return (
              <TableRow key={item.name}>
                <TableCell>{item.name}</TableCell>
                <TableCell className="text-right">
                  ₱{item.budgeted.toLocaleString()}
                </TableCell>
                <TableCell className="text-right">
                  ₱{item.actual.toLocaleString()}
                </TableCell>
                <TableCell className="text-right">
                  <Badge
                    variant={variance >= 0 ? 'default' : 'destructive'}
                    className={variance >= 0 ? 'bg-green-600/80' : ''}
                  >
                    ₱{Math.abs(variance).toLocaleString()}
                  </Badge>
                </TableCell>
                <TableCell>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" className="h-8 w-8 p-0">
                        <span className="sr-only">Open menu</span>
                        <MoreVertical className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem
                        onClick={() => {
                          setEditingBudgetItem({ item, type });
                          setIsAddBudgetItemDialogOpen(true);
                        }}
                      >
                        Edit
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        className="text-destructive"
                        onClick={() =>
                          setItemToDelete({
                            docId: budget!.id,
                            name: item.name,
                          })
                        }
                      >
                        Delete
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );

  const renderPieChart = (title: string, data: any[]) => {
    const chartData = data
      .filter((item) => item.actual > 0)
      .map((item) => ({
        name: item.name,
        value: item.actual,
      }));
    if (chartData.length === 0) return null;

    const chartConfig = data.reduce((acc, item, index) => {
      acc[item.name] = {
        label: item.name,
        color: COLORS[index % COLORS.length],
      };
      return acc;
    }, {});

    return (
      <Card className="mt-6">
        <CardHeader>
          <CardTitle>{title}</CardTitle>
        </CardHeader>
        <CardContent>
          <ChartContainer
            config={chartConfig}
            className="mx-auto aspect-square h-[250px]"
          >
            <ResponsiveContainer>
              <PieChart>
                <ChartTooltip content={<ChartTooltipContent hideLabel />} />
                <Pie
                  data={chartData}
                  dataKey="value"
                  nameKey="name"
                  innerRadius={60}
                  strokeWidth={5}
                >
                  {chartData.map((_, index) => (
                    <Cell
                      key={`cell-${index}`}
                      fill={COLORS[index % COLORS.length]}
                    />
                  ))}
                </Pie>
                <ChartLegend content={<ChartLegendContent />} />
              </PieChart>
            </ResponsiveContainer>
          </ChartContainer>
        </CardContent>
      </Card>
    );
  };

  return (
    <>
      <Tabs defaultValue="manual">
        <TabsList className="grid w-full grid-cols-1">
          <TabsTrigger value="manual">Manual Budget</TabsTrigger>
        </TabsList>
        <TabsContent value="manual">
          <Card>
            <CardHeader className="flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div className="flex-1">
                <CardTitle>{format(selectedDate, 'MMMM yyyy')}</CardTitle>
                <CardDescription>
                  Here is your budget overview. You can add new items or edit
                  amounts directly.
                </CardDescription>
              </div>
              <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
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
                <Button onClick={() => handleDialogOpenChange(true)}>
                  <PlusCircle className="mr-2 h-4 w-4" />
                  Add Item
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {isBudgetsLoading ||
              isSingleTransactionsLoading ||
              isRecurringTransactionsLoading ? (
                <div className="flex items-center justify-center p-8">
                  <Loader2 className="mr-2 h-8 w-8 animate-spin" />
                  <p>Loading budget...</p>
                </div>
              ) : budget ? (
                <div className="space-y-8">
                  <div>
                    {renderBudgetTable('Income', budget.income || [], 'income')}
                    {renderPieChart('Income Sources', budget.income || [])}
                  </div>
                  <div>
                    {renderBudgetTable(
                      'Expenses',
                      budget.expenses || [],
                      'expense'
                    )}
                    {renderPieChart(
                      'Expense Categories',
                      budget.expenses || []
                    )}
                  </div>
                   <div>
                    {renderBudgetTable(
                      'Liabilities',
                      budget.liabilities || [],
                      'liability'
                    )}
                    {renderPieChart(
                      'Liability Payments',
                      budget.liabilities || []
                    )}
                  </div>
                </div>
              ) : (
                <div className="text-center py-12">
                  <p className="text-muted-foreground">
                    No budget found for {format(selectedDate, 'MMMM yyyy')}.
                  </p>
                  <Button
                    onClick={() => handleDialogOpenChange(true)}
                    className="mt-4"
                  >
                    <PlusCircle className="mr-2 h-4 w-4" />
                    Create Budget
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <Dialog
        open={isAddBudgetItemDialogOpen}
        onOpenChange={handleDialogOpenChange}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              {editingBudgetItem ? 'Edit' : 'Add'} Budget Item
            </DialogTitle>
            <DialogDescription>
              {editingBudgetItem
                ? 'Update this item'
                : 'Add a new income or expense category'}{' '}
              to your budget for {format(selectedDate, 'MMMM yyyy')}.
            </DialogDescription>
          </DialogHeader>
          <Form {...budgetItemForm}>
            <form
              onSubmit={budgetItemForm.handleSubmit(handleAddBudgetItem)}
              id="budgetItem-form"
              className="space-y-4"
            >
              <FormField
                control={budgetItemForm.control}
                name="type"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Type</FormLabel>
                    <Select
                      onValueChange={field.onChange}
                      defaultValue={field.value}
                      disabled={!!editingBudgetItem}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select type" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="income">Income</SelectItem>
                        <SelectItem value="expense">Expense</SelectItem>
                        <SelectItem value="liability">Liability</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={budgetItemForm.control}
                name="category"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Category</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select a category" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {(itemType === 'income'
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
                control={budgetItemForm.control}
                name="budgeted"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Budgeted (₱)</FormLabel>
                    <FormControl>
                      <Input type="number" placeholder="10000" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </form>
          </Form>
          <DialogFooter>
            <DialogClose asChild>
              <Button type="button" variant="secondary">
                Cancel
              </Button>
            </DialogClose>
            <Button type="submit" form="budgetItem-form">
              {editingBudgetItem ? 'Save Changes' : 'Add Item'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog
        open={!!itemToDelete}
        onOpenChange={(open) => !open && setItemToDelete(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. This will permanently delete the
              budget item "{itemToDelete?.name}".
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setItemToDelete(null)}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteItem}>
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
