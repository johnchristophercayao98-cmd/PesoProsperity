
'use client';
import { usePathname, useRouter } from 'next/navigation';
import { useState } from 'react';
import {
  SidebarTrigger,
  useSidebar,
} from '@/components/ui/sidebar';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import Link from 'next/link';
import { useAuth } from '@/firebase';
import { signOut } from 'firebase/auth';
import { useToast } from '@/hooks/use-toast';
import { useUser } from '@/firebase/provider';
import { SupportDialog } from './support-dialog';
import { useLanguage } from '@/context/language-context';

export function Header() {
  const { isMobile } = useSidebar();
  const pathname = usePathname();
  const auth = useAuth();
  const router = useRouter();
  const { toast } = useToast();
  const { user } = useUser();
  const [isSupportDialogOpen, setIsSupportDialogOpen] = useState(false);
  const { t } = useLanguage();


  const handleLogout = async () => {
    try {
      await signOut(auth);
      toast({ title: t('loggedOut'), description: t('loggedOutSuccess') });
      router.push('/login');
    } catch (error) {
      toast({ variant: 'destructive', title: t('logoutFailed'), description: t('logoutFailedError') });
    }
  };
  
  const getBreadcrumbs = () => {
    const parts = pathname.split('/').filter((part) => part);
    if (parts[0] !== 'dashboard') return [];

    let path = '/dashboard';
    const crumbs = parts.slice(1).map((part) => {
      path += `/${part}`;
      const labelKey = part.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase()).replace(/ /g, '');
      const translatedLabel = t(labelKey.charAt(0).toLowerCase() + labelKey.slice(1));
      return {
        href: path,
        label: translatedLabel || part.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase()),
      };
    });
    return [{ href: '/dashboard', label: t('dashboard') }, ...crumbs];
  };

  const breadcrumbs = getBreadcrumbs();
  
  const getAvatarFallback = () => {
    if (user?.isAnonymous) return "G";
    if (user?.displayName) {
      const nameParts = user.displayName.split(' ');
      return nameParts[0][0] + (nameParts.length > 1 ? nameParts[1][0] : '');
    }
    return "??";
  }

  return (
    <>
      <header className="sticky top-0 z-30 flex h-14 items-center gap-4 border-b bg-background/80 backdrop-blur-sm px-4 sm:static sm:h-auto sm:border-0 sm:bg-transparent sm:px-6">
        {isMobile && <SidebarTrigger />}
        
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          {breadcrumbs.map((crumb, index) => (
            <div key={crumb.href} className="flex items-center gap-2">
              {index > 0 && <span>/</span>}
              <Link href={crumb.href} className="hover:text-foreground transition-colors">
                {crumb.label}
              </Link>
            </div>
          ))}
        </div>

        <div className="ml-auto flex items-center gap-4">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" className="relative h-8 w-8 rounded-full">
                <Avatar className="h-9 w-9">
                  <AvatarImage src={user?.photoURL ?? undefined} alt="User Avatar" />
                  <AvatarFallback>{getAvatarFallback()}</AvatarFallback>
                </Avatar>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuLabel>{user?.isAnonymous ? t('guestAccount') : user?.email}</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem asChild>
                <Link href="/dashboard/settings">{t('settings')}</Link>
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setIsSupportDialogOpen(true)}>
                {t('support')}
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={handleLogout}>{t('logout')}</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </header>
      <SupportDialog open={isSupportDialogOpen} onOpenChange={setIsSupportDialogOpen} />
    </>
  );
}
