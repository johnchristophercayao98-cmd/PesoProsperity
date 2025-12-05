
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
import { useLanguage } from '@/context/language-context';

type SupportDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

export function SupportDialog({ open, onOpenChange }: SupportDialogProps) {
  const { t } = useLanguage();
  
  const supportTopics = [
    {
      title: t('financialPlanning'),
      content: t('supportFinancialPlanning'),
    },
    {
      title: t('transactions'),
      content: t('supportTransactions'),
    },
    {
      title: t('costControl'),
      content: t('supportCostControl'),
    },
    {
      title: t('cashFlow'),
      content: t('supportCashFlow'),
    },
    {
      title: t('reports'),
      content: t('supportReports'),
    },
    {
      title: t('settings'),
      content: t('supportSettings'),
    },
  ];
  
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{t('supportFaq')}</DialogTitle>
          <DialogDescription>
            {t('supportDescription')}
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
