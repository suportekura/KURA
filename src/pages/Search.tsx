import { useState, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import defaultSellerAvatar from '@/assets/default-seller-avatar.png';
import { motion } from 'framer-motion';
import { Search as SearchIcon, X, ShirtIcon } from 'lucide-react';
import { AppLayout } from '@/components/layout/AppLayout';
import { ProductGrid } from '@/components/products/ProductGrid';
import { Button } from '@/components/ui/button';
import { categories } from '@/data/mockProducts';
import { useInfiniteProducts } from '@/hooks/useInfiniteProducts';
import { ProductWithDistance } from '@/hooks/useProducts';
import { useProfileSearch, ProfileSearchResult } from '@/hooks/useProfileSearch';
import { Product, ProductGender } from '@/types';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import { fadeUpVariants, staggerContainer, staggerItem, DURATION, EASE } from '@/lib/animations';

const popularBrands = ['Zara', 'Farm', 'Animale', 'Le Lis Blanc', "Levi's", 'Reserva', 'Renner', 'C&A', 'Hering', 'Forum', 'Colcci'];
const trendingTerms = ['Vintage', 'Y2K', 'Oversized', 'Tie-dye', 'Streetwear', 'Minimalista', 'Boho'];

const genderChips: { id: ProductGender | 'all'; label: string }[] = [
  { id: 'all', label: 'Todos' },
  { id: 'M', label: 'Masculino' },
  { id: 'F', label: 'Feminino' },
  { id: 'U', label: 'Unissex' },
];

function ProfileCard({ profile }: { profile: ProfileSearchResult }) {
  const navigate = useNavigate();
  const initials = (profile.display_name || '?').slice(0, 2).toUpperCase();
  const hasPaidPlan = profile.plan_type && ['plus', 'brecho', 'loja'].includes(profile.plan_type);
  const badgeLabel = profile.plan_type === 'loja' ? 'LOJA' : profile.plan_type === 'brecho' ? 'BRECHÓ' : 'PLUS';

  return (
    <div className="flex items-center gap-3 p-3 rounded-2xl bg-card border border-border/50">
      <div className="w-11 h-11 rounded-full bg-primary/20 flex items-center justify-center shrink-0 text-primary font-semibold text-sm overflow-hidden">
        {profile.avatar_url
          ? <img src={profile.avatar_url} alt={profile.display_name || ''} className="w-full h-full object-cover" />
          : initials}
      </div>
      <div className="flex-1 min-w-0">
        <p className="font-semibold text-sm truncate">{profile.display_name || 'Usuário'}</p>
        {profile.username && (
          <p className="text-xs text-primary">@{profile.username}</p>
        )}
        {hasPaidPlan && (
          <span className="inline-block mt-0.5 px-2 py-0.5 rounded-full bg-primary text-primary-foreground text-[10px] font-semibold">
            ✦ {badgeLabel}
          </span>
        )}
      </div>
      <Button
        size="sm"
        variant="outline"
        className="shrink-0 text-xs"
        onClick={() => navigate(`/seller/${profile.user_id}`)}
      >
        Ver perfil
      </Button>
    </div>
  );
}

export default function Search() {
  const [query, setQuery] = useState('');
  const [isFocused, setIsFocused] = useState(false);
  const [selectedGender, setSelectedGender] = useState<ProductGender | 'all'>('all');
  const [recentSearches, setRecentSearches] = useState<string[]>([
    'Blazer linho', 'Vestido midi', 'Jaqueta jeans', 'Calça wide leg',
  ]);
  const [activeTab, setActiveTab] = useState<'clothing' | 'profiles'>('clothing');
  const [profileQuery, setProfileQuery] = useState('');
  const { results: profileResults, loading: profileLoading, error: profileError } = useProfileSearch(profileQuery);

  const { data, isLoading } = useInfiniteProducts({});

  const allProducts = useMemo(() => {
    if (!data?.pages) return [];
    return data.pages.flatMap(page => page.products);
  }, [data]);

  const searchResults = useMemo(() => {
    if (!query.trim()) return [];

    const lowerQuery = query.toLowerCase();
    return allProducts
      .filter((p: ProductWithDistance) => {
        const matchesQuery =
          p.title.toLowerCase().includes(lowerQuery) ||
          p.brand.toLowerCase().includes(lowerQuery) ||
          p.description.toLowerCase().includes(lowerQuery);
        const matchesGender =
          selectedGender === 'all' || p.gender === selectedGender;
        return matchesQuery && matchesGender;
      })
      .map((p: ProductWithDistance): Product => ({
        id: p.id,
        title: p.title,
        description: p.description,
        price: p.price,
        originalPrice: p.originalPrice || undefined,
        size: p.size,
        brand: p.brand,
        category: p.category,
        condition: p.condition,
        images: p.images.length > 0 ? p.images : ['https://images.unsplash.com/photo-1558171813-4c088753af8f?w=800'],
        sellerId: p.sellerId,
        sellerName: p.sellerDisplayName || 'Vendedor',
        sellerAvatar: p.sellerAvatarUrl || defaultSellerAvatar,
        sellerReviewsCount: 0,
        sellerReviewsSum: 0,
        sellerPlanType: p.sellerPlanType || null,
        distance: p.distance ?? 0,
        city: p.sellerCity || 'Localização desconhecida',
        createdAt: p.createdAt,
        isFavorite: false,
      }));
  }, [allProducts, query, selectedGender]);

  const handleSearch = useCallback((term: string) => {
    setQuery(term);
    setRecentSearches(prev => {
      const filtered = prev.filter(s => s !== term);
      return [term, ...filtered].slice(0, 8);
    });
  }, []);

  const showResults = query.trim().length > 0;

  return (
    <AppLayout showHeader={false}>
      <motion.div
        initial="hidden"
        animate="visible"
        variants={staggerContainer}
        className="px-4 py-6 space-y-6"
      >
        {/* Search Header */}
        <motion.div variants={fadeUpVariants} transition={{ duration: DURATION.fast, ease: EASE.out }} className="space-y-1">
          <h1 className="font-display text-3xl font-semibold text-foreground">Buscar</h1>
          <p className="text-muted-foreground">Encontre peças únicas</p>
        </motion.div>

        {/* Search Input */}
        <div className="relative">
          <SearchIcon className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
          <input
            type="text"
            value={activeTab === 'profiles' ? profileQuery : query}
            onChange={(e) => {
              const v = e.target.value;
              if (activeTab === 'profiles') {
                setProfileQuery(v);
              } else {
                setQuery(v);
              }
            }}
            onFocus={() => setIsFocused(true)}
            onBlur={() => setIsFocused(false)}
            placeholder={activeTab === 'profiles' ? 'Buscar por @username ou nome...' : 'Buscar por nome, marca ou categoria...'}
            className={cn(
              'w-full pl-12 pr-10 py-4 rounded-2xl bg-card border transition-all duration-300',
              isFocused ? 'border-primary/50 ring-4 ring-primary/10' : 'border-border/50'
            )}
          />
          {(activeTab === 'profiles' ? profileQuery : query) && (
            <button
              onClick={() => activeTab === 'profiles' ? setProfileQuery('') : setQuery('')}
              className="absolute right-4 top-1/2 -translate-y-1/2 w-6 h-6 rounded-full bg-muted flex items-center justify-center"
            >
              <X className="w-3 h-3" />
            </button>
          )}
        </div>

        {/* Tab Switcher */}
        <div className="flex border-b border-border">
          {(['clothing', 'profiles'] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={cn(
                'flex-1 py-2.5 text-sm font-medium transition-colors',
                activeTab === tab
                  ? 'text-primary border-b-2 border-primary -mb-px'
                  : 'text-muted-foreground hover:text-foreground'
              )}
            >
              {tab === 'clothing' ? 'Vestuário' : 'Perfis'}
            </button>
          ))}
        </div>

        {activeTab === 'clothing' ? (
          <>
            {/* Gender Chips */}
            <div className="flex items-center gap-2 overflow-x-auto no-scrollbar">
              {genderChips.map((g) => (
                <button
                  key={g.id}
                  onClick={() => setSelectedGender(g.id)}
                  className={cn(
                    'px-4 py-2 rounded-xl text-sm font-medium whitespace-nowrap transition-all duration-200 shrink-0',
                    selectedGender === g.id
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-card border border-border/50 hover:border-primary/50'
                  )}
                >
                  {g.label}
                </button>
              ))}
            </div>

            {showResults ? (
              /* Search Results */
              <div className="space-y-4">
                {isLoading ? (
                  <div className="grid grid-cols-2 gap-3">
                    {[...Array(4)].map((_, i) => (
                      <div key={i} className="space-y-3">
                        <Skeleton className="aspect-[3/4] rounded-2xl" />
                        <Skeleton className="h-4 w-3/4" />
                        <Skeleton className="h-4 w-1/2" />
                      </div>
                    ))}
                  </div>
                ) : (
                  <>
                    <p className="text-sm text-muted-foreground">
                      {searchResults.length} resultados para "{query}"
                    </p>
                    {searchResults.length > 0 ? (
                      <ProductGrid products={searchResults} />
                    ) : (
                      <motion.div
                        initial={{ opacity: 0, y: 12 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="flex flex-col items-center justify-center py-16 space-y-3"
                      >
                        <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center">
                          <ShirtIcon className="w-8 h-8 text-muted-foreground" />
                        </div>
                        <p className="font-medium text-foreground text-lg">Nenhuma peça encontrada</p>
                        <p className="text-sm text-muted-foreground text-center max-w-xs">
                          Tente outro termo ou explore as categorias abaixo
                        </p>
                      </motion.div>
                    )}
                  </>
                )}
              </div>
            ) : (
              /* Discovery Content */
              <motion.div variants={staggerItem} className="space-y-8">
                {/* Recent Searches */}
                {recentSearches.length > 0 && (
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <h2 className="font-display text-lg font-semibold text-foreground">Buscas recentes</h2>
                      <button
                        onClick={() => setRecentSearches([])}
                        className="text-xs text-muted-foreground hover:text-foreground transition-colors"
                      >
                        Limpar
                      </button>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {recentSearches.map((search) => (
                        <button
                          key={search}
                          onClick={() => handleSearch(search)}
                          className="px-4 py-2 rounded-xl bg-card border border-border/50 text-sm hover:border-primary/50 transition-colors"
                        >
                          {search}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Popular Brands - horizontal scroll */}
                <div className="space-y-3">
                  <h2 className="font-display text-lg font-semibold text-foreground">Marcas populares</h2>
                  <div className="flex gap-2 overflow-x-auto no-scrollbar -mx-4 px-4">
                    {popularBrands.map((brand) => (
                      <button
                        key={brand}
                        onClick={() => handleSearch(brand)}
                        className="px-4 py-2 rounded-xl bg-primary/10 text-primary text-sm font-medium hover:bg-primary/20 transition-colors whitespace-nowrap shrink-0"
                      >
                        {brand}
                      </button>
                    ))}
                  </div>
                </div>


                {/* Categories - all 10 */}
                <div className="space-y-3">
                  <h2 className="font-display text-lg font-semibold text-foreground">Categorias</h2>
                  <div className="grid grid-cols-2 gap-3">
                    {categories.map((category) => {
                      const Icon = category.icon;
                      return (
                        <button
                          key={category.id}
                          onClick={() => handleSearch(category.label)}
                          className="card-premium p-4 flex items-center gap-3 hover:shadow-elevated transition-all"
                        >
                          <Icon className="w-6 h-6 text-primary" />
                          <span className="font-medium text-foreground">{category.label}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              </motion.div>
            )}
          </>
        ) : (
          /* Profiles tab */
          <div className="space-y-3 p-4">
            {profileQuery.replace(/^@/, '').trim().length < 2 ? (
              <p className="text-center text-muted-foreground text-sm py-10">
                Digite @username ou nome de uma loja
              </p>
            ) : profileLoading ? (
              <div className="space-y-3">
                {[...Array(3)].map((_, i) => (
                  <div key={i} className="flex items-center gap-3 p-3">
                    <Skeleton className="w-11 h-11 rounded-full shrink-0" />
                    <div className="flex-1 space-y-2">
                      <Skeleton className="h-4 w-32" />
                      <Skeleton className="h-3 w-20" />
                    </div>
                  </div>
                ))}
              </div>
            ) : profileError ? (
              <p className="text-center text-destructive text-sm py-10">{profileError}</p>
            ) : profileResults.length === 0 ? (
              <p className="text-center text-muted-foreground text-sm py-10">
                Nenhum perfil encontrado para "{profileQuery}"
              </p>
            ) : (
              profileResults.map((p) => <ProfileCard key={p.user_id} profile={p} />)
            )}
          </div>
        )}
      </motion.div>
    </AppLayout>
  );
}
