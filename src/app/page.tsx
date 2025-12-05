
'use client';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { ArrowRight, BarChart, Goal, PiggyBank } from 'lucide-react';
import { Logo } from '@/components/icons/logo';
import { useLanguage } from '@/context/language-context';

export default function LandingPage() {
  const { t } = useLanguage();

  return (
    <div className="flex flex-col min-h-screen">
      <header className="container mx-auto px-4 sm:px-6 lg:px-8 py-4">
        <div className="flex justify-between items-center">
          <div className="flex items-center gap-2">
            <Logo className="h-8 w-8 text-primary" />
            <span className="text-2xl font-bold text-primary">PesoProsperity</span>
          </div>
          <Button asChild>
            <Link href="/login">{t('login')}</Link>
          </Button>
        </div>
      </header>

      <main className="flex-1">
        <section className="py-20 md:py-32 bg-secondary/50">
          <div className="container mx-auto px-4 sm:px-6 lg:px-8 text-center">
            <h1 className="text-4xl md:text-6xl font-headline font-bold text-primary tracking-tight">
              {t('landingTitle')}
            </h1>
            <p className="mt-6 max-w-3xl mx-auto text-lg md:text-xl text-muted-foreground">
              {t('landingSubtitle')}
            </p>
            <div className="mt-10 flex justify-center gap-4">
              <Button size="lg" asChild>
                <Link href="/signup">
                  {t('getStartedForFree')}
                  <ArrowRight className="ml-2 h-5 w-5" />
                </Link>
              </Button>
            </div>
          </div>
        </section>

        <section className="py-20 md:py-24">
          <div className="container mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center mb-16">
              <h2 className="text-3xl md:text-4xl font-headline font-bold text-primary">{t('toolkitTitle')}</h2>
              <p className="mt-4 max-w-2xl mx-auto text-lg text-muted-foreground">{t('toolkitSubtitle')}</p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              <Card className="text-center">
                <CardContent className="p-8">
                  <div className="flex justify-center mb-4">
                    <div className="bg-accent/30 p-4 rounded-full">
                      <Goal className="h-8 w-8 text-primary" />
                    </div>
                  </div>
                  <h3 className="text-xl font-bold font-headline">{t('featureFinancialPlanning')}</h3>
                  <p className="mt-2 text-muted-foreground">{t('featureFinancialPlanningDescription')}</p>
                </CardContent>
              </Card>
              <Card className="text-center">
                <CardContent className="p-8">
                  <div className="flex justify-center mb-4">
                    <div className="bg-accent/30 p-4 rounded-full">
                      <PiggyBank className="h-8 w-8 text-primary" />
                    </div>
                  </div>
                  <h3 className="text-xl font-bold font-headline">{t('featureCostControl')}</h3>
                  <p className="mt-2 text-muted-foreground">{t('featureCostControlDescription')}</p>
                </CardContent>
              </Card>
              <Card className="text-center">
                <CardContent className="p-8">
                  <div className="flex justify-center mb-4">
                    <div className="bg-accent/30 p-4 rounded-full">
                      <BarChart className="h-8 w-8 text-primary" />
                    </div>
                  </div>
                  <h3 className="text-xl font-bold font-headline">{t('featureCashFlow')}</h3>
                  <p className="mt-2 text-muted-foreground">{t('featureCashFlowDescription')}</p>
                </CardContent>
              </Card>
            </div>
          </div>
        </section>
      </main>

      <footer className="py-6 bg-secondary/50">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8 text-center text-muted-foreground">
          <p>&copy; {new Date().getFullYear()} PesoProsperity. {t('allRightsReserved')}</p>
        </div>
      </footer>
    </div>
  );
}
