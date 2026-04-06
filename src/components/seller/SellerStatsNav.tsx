import { cn } from '@/lib/utils';

export type SellerTab = 'products' | 'sold' | 'reviews' | 'followers';

interface SellerStatsNavProps {
  activeTab: SellerTab;
  onTabChange: (tab: SellerTab) => void;
  stats: {
    activeProducts: number;
    soldProducts: number;
    reviewsCount: number;
    followersCount: number;
  };
}

export function SellerStatsNav({ activeTab, onTabChange, stats }: SellerStatsNavProps) {
  const tabs: { id: SellerTab; label: string; count: number }[] = [
    { id: 'products', label: 'à venda', count: stats.activeProducts },
    { id: 'sold', label: 'vendidos', count: stats.soldProducts },
    { id: 'reviews', label: 'avaliações', count: stats.reviewsCount },
    { id: 'followers', label: 'seguidores', count: stats.followersCount },
  ];

  return (
    <div className="border-b border-border">
      <div className="flex justify-between px-4">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => onTabChange(tab.id)}
            className={cn(
              "flex flex-col items-center py-3 px-2 relative transition-colors min-w-0",
              activeTab === tab.id 
                ? "text-primary" 
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            <span className="text-lg font-bold">{tab.count}</span>
            <span className="text-xs truncate">{tab.label}</span>
            
            {activeTab === tab.id && (
              <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary" />
            )}
          </button>
        ))}
      </div>
    </div>
  );
}
