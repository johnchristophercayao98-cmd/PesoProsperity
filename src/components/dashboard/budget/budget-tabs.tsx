'use client';

import { useState, useMemo } from 'react';
import {
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Input,
  Label,
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
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
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
} from '@/components/ui';
import { ResponsiveContainer, Pie, PieChart, Cell } from 'recharts';
import { useToast } from '@/hooks/use-toast';
import {
  Loader2,
  Upload,
  FileText,
  PlusCircle,
  Calendar as CalendarIcon,
  Trash2,
  MoreVertical,
} from 'lucide-react';
import {
  suggestMonthlyBudget,
  SuggestMonthlyBudgetOutput,
} from '@/ai/flows/automated-budget-suggestions';
import type { Budget, Transaction } from '@/lib/types';
import { format, startOfMonth, endOfMonth } from 'date-fns';
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
import { collection, query, where, doc } from 'firebase/firestore';

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
  'Software and Subscriptions',
  'Taxes',
  'Travel',
  'Repairs and Maintenance',
  'Other',
];

const budgetItemSchema = z.object({
  id: z.string().optional(),
  type: z.enum(['income', 'expense']),
  category: z.string().min(2, 'Category is required.'),
  budgeted: z.coerce
    .number()
    .min(0, 'Budgeted amount must be a positive number.'),
});

type BudgetItemFormData = z.infer<typeof budgetItemSchema>;

export function BudgetTabs() {
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const [aiResult, setAiResult] = useState<SuggestMonthlyBudgetOutput | null>(
    null
  );
  const [fileName, setFileName] = useState<string | null>(null);
  const [isAddBudgetItemDialogOpen, setIsAddBudgetItemDialogOpen] =
    useState(false);
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [itemToDelete, setItemToDelete] = useState<{
    docId: string;
    name: string;
  } | null>(null);

  const firestore = useFirestore();
  const { user } = useUser();

  const monthStart = startOfMonth(selectedDate);
  const monthEnd = endOfMonth(selectedDate);

  const budgetsQuery = useMemoFirebase(() => {
    if (!user) return null;
    return query(
      collection(firestore, 'users', user.uid, 'budgets'),
      where('startDate', '>=', monthStart),
      where('startDate', '<=', monthEnd)
    );
  }, [firestore, user, monthStart, monthEnd]);

  const { data: budgets, isLoading: isBudgetsLoading } =
    useCollection<Budget>(budgetsQuery);

  const transactionsQuery = useMemoFirebase(() => {
    if (!user) return null;
    return query(
      collection(firestore, 'users', user.uid, 'expenses'),
      where('date', '>=', monthStart),
      where('date', '<=', monthEnd)
    );
  }, [firestore, user, monthStart, monthEnd]);
  
  const { data: transactions, isLoading: isTransactionsLoading } = useCollection<Transaction>(transactionsQuery);

  const budget = useMemo(() => {
    const baseBudget = budgets?.[0] ?? null;
    if (!baseBudget || !transactions) return baseBudget;

    const calculateActuals = (categories: any[], type: 'Income' | 'Expense') => {
      return categories.map(category => {
        const actual = transactions
          .filter(t => t.category === type && t.subcategory === category.name)
          .reduce((sum, t) => sum + t.amount, 0);
        return { ...category, actual };
      });
    };

    return {
      ...baseBudget,
      income: calculateActuals(baseBudget.income || [], 'Income'),
      expenses: calculateActuals(baseBudget.expenses || [], 'Expense'),
    };

  }, [budgets, transactions]);


  const budgetItemForm = useForm<BudgetItemFormData>({
    resolver: zodResolver(budgetItemSchema),
    defaultValues: {
      type: 'expense',
      category: '',
      budgeted: 0,
    },
  });
  const itemType = budgetItemForm.watch('type');

  const handleAddBudgetItem = async (data: BudgetItemFormData) => {
    if (!user || !firestore) return;

    const newCategory = {
      name: data.category,
      budgeted: data.budgeted,
      actual: 0,
    };

    let updatedIncome = budget?.income ? [...budget.income] : [];
    let updatedExpenses = budget?.expenses ? [...budget.expenses] : [];

    if (data.type === 'income') {
      updatedIncome.push(newCategory);
    } else {
      updatedExpenses.push(newCategory);
    }

    if (budget) {
      // Update existing budget document
      const budgetRef = doc(firestore, 'users', user.uid, 'budgets', budget.id);
      updateDocumentNonBlocking(budgetRef, {
        income: updatedIncome.map(({actual, ...rest}) => rest), // Don't save actual
        expenses: updatedExpenses.map(({actual, ...rest}) => rest),
      });
    } else {
      // Create new budget document
      const budgetCollRef = collection(firestore, 'users', user.uid, 'budgets');
      addDocumentNonBlocking(budgetCollRef, {
        userId: user.uid,
        name: `${format(selectedDate, 'MMMM yyyy')} Budget`,
        startDate: startOfMonth(selectedDate),
        endDate: endOfMonth(selectedDate),
        income: data.type === 'income' ? [newCategory] : [],
        expenses: data.type === 'expense' ? [newCategory] : [],
      });
    }

    toast({
      title: 'Budget Item Added!',
      description: `${data.category} has been added to your budget for ${format(
        selectedDate,
        'MMMM yyyy'
      )}.`,
    });
    budgetItemForm.reset();
    setIsAddBudgetItemDialogOpen(false);
  };

  const handleDeleteItem = () => {
    if (!itemToDelete || !budget || !user) return;

    const updatedIncome = budget.income.filter(
      (i) => i.name !== itemToDelete.name
    );
    const updatedExpenses = budget.expenses.filter(
      (e) => e.name !== itemToDelete.name
    );

    const budgetRef = doc(firestore, 'users', user.uid, 'budgets', budget.id);
    updateDocumentNonBlocking(budgetRef, {
      income: updatedIncome.map(({actual, ...rest}) => rest),
      expenses: updatedExpenses.map(({actual, ...rest}) => rest),
    });

    toast({
      title: 'Item Deleted',
      description: `The item "${itemToDelete.name}" has been removed from your budget.`,
    });
    setItemToDelete(null);
  };

  const handleFileChange = async (
    event: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setIsLoading(true);
    setFileName(file.name);
    setAiResult(null);

    try {
      const content = await file.text();
      const result = await suggestMonthlyBudget({ financialData: content });

      if (result.suggestedBudget && JSON.parse(result.suggestedBudget).error) {
        toast({
          variant: 'destructive',
          title: 'AI Analysis Error',
          description:
            'The AI could not process the uploaded file. Please check the format and try again.',
        });
        setAiResult(null);
      } else {
        setAiResult(result);
        toast({
          title: 'AI Budget Suggestion Ready!',
          description: 'Your automated budget suggestion has been generated.',
        });
      }
    } catch (error) {
      console.error('Error processing file with AI:', error);
      toast({
        variant: 'destructive',
        title: 'An Error Occurred',
        description: 'Could not process the file. Please try again.',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const renderBudgetTable = (
    title: string,
    data: any[],
    type: 'income' | 'expense'
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
            const variance = item.budgeted - item.actual;
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
                          /* TODO: Implement Edit */
                        }}
                      >
                        Edit
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        className="text-destructive"
                        onClick={() =>
                          setItemToDelete({ docId: budget!.id, name: item.name })
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
    const chartData = data.map((item) => ({
      name: item.name,
      value: item.actual,
    }));
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
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="manual">Manual Budget</TabsTrigger>
          <TabsTrigger value="ai">AI Budget Suggester</TabsTrigger>
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
              <div className="flex gap-2">
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
                <Button onClick={() => setIsAddBudgetItemDialogOpen(true)}>
                  <PlusCircle className="mr-2 h-4 w-4" />
                  Add Item
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {isBudgetsLoading || isTransactionsLoading ? (
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
                </div>
              ) : (
                <div className="text-center py-12">
                  <p className="text-muted-foreground">
                    No budget found for {format(selectedDate, 'MMMM yyyy')}.
                  </p>
                  <Button
                    onClick={() => setIsAddBudgetItemDialogOpen(true)}
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
        <TabsContent value="ai">
          <Card>
            <CardHeader>
              <CardTitle>AI Budget Suggester</CardTitle>
              <CardDescription>
                Upload a CSV of your financial data to get a personalized
                budget suggestion.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label htmlFor="financial-data-file" className="sr-only">
                  Upload File
                </Label>
                <Input
                  id="financial-data-file"
                  type="file"
                  accept=".csv, text/csv"
                  className="hidden"
                  onChange={handleFileChange}
                  disabled={isLoading}
                />
                <Button asChild variant="outline" className="w-full cursor-pointer">
                  <label htmlFor="financial-data-file">
                    <Upload className="mr-2 h-4 w-4" />
                    Choose a file
                  </label>
                </Button>
              </div>
              {isLoading && (
                <div className="flex items-center justify-center p-8">
                  <Loader2 className="mr-2 h-8 w-8 animate-spin" />
                  <p>AI is analyzing your data...</p>
                </div>
              )}
              {fileName && !isLoading && (
                <div className="flex items-center p-3 rounded-md border bg-secondary/50">
                  <FileText className="h-5 w-5 mr-2 text-primary" />
                  <span className="text-sm font-medium">{fileName}</span>
                </div>
              )}
              {aiResult && aiResult.suggestedBudget && (
                <Card className="bg-secondary/50">
                  <CardHeader>
                    <CardTitle>Suggested Budget</CardTitle>
                    <CardDescription>{aiResult.explanation}</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <pre className="p-4 bg-background rounded-md text-sm overflow-x-auto">
                      {JSON.stringify(
                        JSON.parse(aiResult.suggestedBudget),
                        null,
                        2
                      )}
                    </pre>
                  </CardContent>
                </Card>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <Dialog
        open={isAddBudgetItemDialogOpen}
        onOpenChange={setIsAddBudgetItemDialogOpen}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Add Budget Item</DialogTitle>
            <DialogDescription>
              Add a new income or expense category to your budget for{' '}
              {format(selectedDate, 'MMMM yyyy')}.
            </DialogDescription>
          </DialogHeader>
          <Form {...budgetItemForm}>
            <form
              onSubmit={budgetItemForm.handleSubmit(handleAddBudgetItem)}
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
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select type" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="income">Income</SelectItem>
                        <SelectItem value="expense">Expense</SelectItem>
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
              <DialogFooter>
                <DialogClose asChild>
                  <Button type="button" variant="secondary">
                    Cancel
                  </Button>
                </DialogClose>
                <Button type="submit">Add Item</Button>
              </DialogFooter>
            </form>
          </Form>
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
