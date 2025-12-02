import type React from 'react';

type PageHeaderProps = {
  title: string;
  description: string;
  action?: React.ReactNode;
};

export function PageHeader({ title, description, action }: PageHeaderProps) {
  return (
    <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-6 gap-4">
      <div>
        <h1 className="text-2xl md:text-3xl font-bold font-headline text-primary">{title}</h1>
        <p className="mt-1 text-muted-foreground">{description}</p>
      </div>
      {action && <div className='w-full sm:w-auto'>{action}</div>}
    </div>
  );
}
