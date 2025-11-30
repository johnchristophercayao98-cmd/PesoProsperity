'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  BarChartHorizontal,
  FileText,
  GaugeCircle,
  Goal,
  Landmark,
  LayoutDashboard,
  Notebook,
  PieChart,
  Repeat,
  TrendingUp,
  Waves,
  ChevronDown,
} from 'lucide-react';
import {
  SidebarContent,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
  useSidebar,
} from '@/components/ui/sidebar';
import { Logo } from '@/components/icons/logo';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { useState } from 'react';

const navItems = [
  {
    href: '/dashboard',
    label: 'Dashboard',
    icon: LayoutDashboard,
  },
  {
    label: 'Financial Planning',
    icon: FileText,
    subItems: [
      { href: '/dashboard/financial-planning/goals', label: 'Financial Goals', icon: Goal },
      { href: '/dashboard/financial-planning/budget', label: 'Budget Planner', icon: Notebook },
    ],
  },
  {
    label: 'Cost Control',
    icon: GaugeCircle,
    subItems: [
      { href: '/dashboard/cost-control/variance', label: 'Variance Analysis', icon: BarChartHorizontal },
      { href: '/dashboard/cost-control/recurring', label: 'Recurring', icon: Repeat },
    ],
  },
  {
    label: 'Cash Flow',
    icon: Waves,
    subItems: [
      { href: '/dashboard/cash-flow/forecasts', label: 'Forecasts', icon: TrendingUp },
      { href: '/dashboard/cash-flow/debt-tracker', label: 'Debt Tracker', icon: Landmark },
    ],
  },
  {
    href: '/dashboard/reports',
    label: 'Reports',
    icon: PieChart,
  },
];

export function SidebarNav() {
  const pathname = usePathname();
  const { state } = useSidebar();
  
  const getInitialOpenState = () => {
    const openSections: Record<string, boolean> = {};
    navItems.forEach(item => {
      if (item.subItems) {
        if (item.subItems.some(sub => pathname.startsWith(sub.href))) {
          openSections[item.label] = true;
        }
      }
    });
    return openSections;
  };
  
  const [openSections, setOpenSections] = useState<Record<string, boolean>>(getInitialOpenState);

  const toggleSection = (label: string) => {
    setOpenSections(prev => ({...prev, [label]: !prev[label]}));
  }

  return (
    <>
      <SidebarHeader>
        <div className="flex items-center gap-2">
          <Logo className="h-8 w-8 text-primary" />
          <span className="text-lg font-semibold text-primary font-headline group-data-[collapsible=icon]:hidden">
            PesoProsperity
          </span>
        </div>
      </SidebarHeader>
      <SidebarContent>
        <SidebarMenu>
          {navItems.map((item, index) =>
            item.subItems ? (
              <Collapsible key={index} open={openSections[item.label]} onOpenChange={() => toggleSection(item.label)}>
                <SidebarMenuItem>
                  <CollapsibleTrigger asChild>
                    <Button
                      variant="ghost"
                      className="peer/menu-button flex w-full items-center justify-between gap-2 overflow-hidden rounded-md p-2 text-left text-sm outline-none ring-sidebar-ring transition-[width,height,padding] hover:bg-sidebar-accent hover:text-sidebar-accent-foreground focus-visible:ring-2 active:bg-sidebar-accent active:text-sidebar-accent-foreground disabled:pointer-events-none disabled:opacity-50 group-data-[collapsible=icon]:!size-8 group-data-[collapsible=icon]:!p-2"
                    >
                      <div className="flex items-center gap-2">
                        <item.icon />
                        <span className="truncate group-data-[collapsible=icon]:hidden">{item.label}</span>
                      </div>
                      <ChevronDown className={cn("h-4 w-4 shrink-0 transition-transform duration-200 group-data-[collapsible=icon]:hidden", openSections[item.label] && "rotate-180")} />
                    </Button>
                  </CollapsibleTrigger>
                </SidebarMenuItem>
                <CollapsibleContent>
                  <SidebarMenuSub>
                    {item.subItems.map((subItem) => (
                      <SidebarMenuSubItem key={subItem.href}>
                        <SidebarMenuSubButton
                          asChild
                          isActive={pathname.startsWith(subItem.href)}
                        >
                          <Link href={subItem.href}>
                            <subItem.icon />
                            <span>{subItem.label}</span>
                          </Link>
                        </SidebarMenuSubButton>
                      </SidebarMenuSubItem>
                    ))}
                  </SidebarMenuSub>
                </CollapsibleContent>
              </Collapsible>
            ) : (
              <SidebarMenuItem key={item.href}>
                <SidebarMenuButton
                  asChild
                  isActive={pathname === item.href}
                  tooltip={state === 'collapsed' ? item.label : undefined}
                >
                  <Link href={item.href!}>
                    <item.icon />
                    <span>{item.label}</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
            )
          )}
        </SidebarMenu>
      </SidebarContent>
    </>
  );
}
