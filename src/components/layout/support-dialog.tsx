
'use client';

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';

type SupportDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

const supportTopics = [
  {
    title: 'Financial Planning',
    content:
      'Use the "Financial Goals" section to set and track long-term objectives like buying new equipment. The "Budget Planner" allows you to create monthly budgets manually or get suggestions from our AI by uploading your financial data.',
  },
  {
    title: 'Transactions',
    content:
      'In the "Transactions" page, you can manually log every income and expense. This gives you a detailed record of all financial activities.',
  },
  {
    title: 'Cost Control',
    content:
      'The "Variance Analysis" report compares your budgeted amounts against your actual spending, highlighting where you are over or under budget. Use the "Recurring" section to manage regular, automated payments and income to avoid missing them.',
  },
  {
    title: 'Cash Flow Management',
    content:
      'The "Statement" provides a month-by-month summary of your cash inflows and outflows, showing your running balance. The "Debt Tracker" helps you monitor and manage your liabilities to improve your financial health.',
  },
  {
    title: 'Reports',
    content:
      'Generate detailed CSV reports for "Income vs. Expense", "Budget Variance", and your "Cash Flow Statement" for any date range to get deeper insights into your business finances.',
  },
  {
    title: 'Settings',
    content:
      'In the "Settings" page, you can update your profile information, including your name and profile picture.',
  },
];

export function SupportDialog({ open, onOpenChange }: SupportDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Support & FAQ</DialogTitle>
          <DialogDescription>
            Here are some quick tips on how to use the main features of PesoProsperity.
          </DialogDescription>
        </DialogHeader>
        <Accordion type="single" collapsible className="w-full">
          {supportTopics.map((topic, index) => (
            <AccordionItem key={index} value={`item-${index}`}>
              <AccordionTrigger>{topic.title}</AccordionTrigger>
              <AccordionContent>{topic.content}</AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      </DialogContent>
    </Dialog>
  );
}
