import { useMemo, useState } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  ArrowUpDown,
  Check,
  Minus,
  Package,
  Plus,
  Search,
  Trash2,
  X,
} from 'lucide-react';
import type { CartItem, CatalogCategory, CatalogItem } from '../types';
import {
  CATALOG,
  CATEGORY_LABELS,
  CATEGORY_ORDER,
  formatKes,
} from '../utils/catalogHelper';

interface CartViewProps {
  items: CartItem[];
  onToggleInclude: (id: number) => void;
  onUpdateQty: (id: number, delta: number) => void;
  onExcludeAllPantry: () => void;
  onAddExtraItem: (catalogItem: CatalogItem) => void;
  onRemoveExtraItem: (id: number) => void;
  onSwapCartItem: (oldId: number, newItem: CatalogItem) => void;
  onBackToMenu: () => void;
  onProceedToCheckout: () => void;
}

function ProductThumb({ src, alt }: { src: string; alt: string }) {
  const [failed, setFailed] = useState(false);

  if (failed || !src) {
    return (
      <div className="h-12 w-12 shrink-0 rounded-xl border border-[#18181B]/10 bg-[#FAF9F6] flex items-center justify-center text-[#52525B]">
        <Package className="h-5 w-5" />
      </div>
    );
  }

  return (
    <img
      src={src}
      alt={alt}
      referrerPolicy="no-referrer"
      onError={() => setFailed(true)}
      className="h-12 w-12 shrink-0 rounded-xl border border-[#18181B]/10 bg-white object-cover"
    />
  );
}

export function CartView({
  items,
  onToggleInclude,
  onUpdateQty,
  onExcludeAllPantry,
  onAddExtraItem,
  onRemoveExtraItem,
  onSwapCartItem,
  onBackToMenu,
  onProceedToCheckout,
}: CartViewProps) {
  const [catalogModalOpen, setCatalogModalOpen] = useState(false);
  const [swapTarget, setSwapTarget] = useState<CartItem | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<CatalogCategory | 'all'>('all');

  const pantryItems = items.filter((i) => i.isPantryStaple);
  const includedPantryItems = pantryItems.filter((i) => i.included);
  const includedPantryTotal = includedPantryItems.reduce(
    (sum, i) => sum + i.price * i.qty,
    0
  );
  const allPantryExcluded =
    pantryItems.length > 0 && includedPantryItems.length === 0;

  const activeItems = items.filter((i) => i.included && i.qty > 0);
  const excludedItems = items.filter((i) => !i.included);

  const totalKes = activeItems.reduce((sum, i) => sum + i.price * i.qty, 0);
  const savedKes = excludedItems.reduce((sum, i) => sum + i.price * i.qty, 0);

  const cartIdSet = useMemo(() => new Set(items.map((i) => i.id)), [items]);

  const browseResults = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return CATALOG.filter((item) => {
      if (swapTarget) {
        if (item.cat !== swapTarget.cat || item.id === swapTarget.id) return false;
      } else if (selectedCategory !== 'all' && item.cat !== selectedCategory) {
        return false;
      }
      if (!q) return true;
      return item.name.toLowerCase().includes(q);
    });
  }, [searchQuery, selectedCategory, swapTarget]);

  const openAddModal = () => {
    setSwapTarget(null);
    setSearchQuery('');
    setSelectedCategory('all');
    setCatalogModalOpen(true);
  };

  const openSwapModal = (item: CartItem) => {
    setSwapTarget(item);
    setSearchQuery('');
    setCatalogModalOpen(true);
  };

  const closeCatalogModal = () => {
    setCatalogModalOpen(false);
    setSwapTarget(null);
    setSearchQuery('');
  };

  return (
    <div className="space-y-6 pb-24">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <button
            type="button"
            onClick={onBackToMenu}
            className="inline-flex items-center gap-1.5 text-xs font-medium text-[#52525B] hover:text-[#18181B] mb-2 py-1 transition-colors duration-150"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            <span>Back to menu</span>
          </button>
          <h1 className="font-display text-2xl sm:text-3xl font-semibold tracking-tight text-[#18181B] text-balance">
            Grocery cart
          </h1>
          <p className="mt-1 text-sm text-[#52525B]">
            Turn off spices or oils you already own, swap products, or add extras from Zucchini.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 shrink-0">
          {pantryItems.length > 0 && (
            <button
              type="button"
              onClick={onExcludeAllPantry}
              className={`inline-flex items-center gap-2 h-11 px-4 rounded-xl border text-xs sm:text-sm font-medium transition-[border-color,background-color,color,transform] duration-150 ease-[cubic-bezier(0.22,1,0.36,1)] active:scale-[0.98] whitespace-nowrap ${
                allPantryExcluded
                  ? 'bg-white border-[#15803D] text-[#15803D]'
                  : 'bg-white border-[#18181B]/10 hover:border-[#EA580C] text-[#18181B]'
              }`}
            >
              <Check
                className={`h-4 w-4 ${
                  allPantryExcluded ? 'text-[#15803D]' : 'text-[#EA580C]'
                }`}
              />
              <span>
                {allPantryExcluded
                  ? 'Spices and oils excluded'
                  : `Exclude spices I own (${formatKes(includedPantryTotal)})`}
              </span>
            </button>
          )}

          <button
            type="button"
            onClick={openAddModal}
            className="inline-flex items-center gap-1.5 h-11 px-4 rounded-xl border border-[#18181B]/10 bg-white hover:border-[#15803D] text-[#18181B] text-xs sm:text-sm font-medium transition-[border-color,transform] duration-150 ease-[cubic-bezier(0.22,1,0.36,1)] active:scale-[0.98] whitespace-nowrap"
          >
            <Plus className="h-4 w-4 text-[#15803D]" />
            <span>Add Zucchini item</span>
          </button>
        </div>
      </div>

      {/* Category Groups */}
      <div className="space-y-6">
        {CATEGORY_ORDER.map((cat) => {
          const catItems = items.filter((i) => i.cat === cat);
          if (catItems.length === 0) return null;

          return (
            <section key={cat} className="space-y-3">
              <div className="flex items-baseline justify-between px-1">
                <h2 className="font-display text-sm font-semibold text-[#18181B]">
                  {CATEGORY_LABELS[cat]}
                </h2>
                <span className="text-xs text-[#52525B] tabular-nums">
                  {catItems.filter((i) => i.included).length} of {catItems.length} in cart
                </span>
              </div>

              <div className="rounded-2xl border border-[#18181B]/10 bg-white divide-y divide-[#18181B]/10 overflow-hidden">
                {catItems.map((item) => {
                  const lineTotal = item.price * item.qty;
                  return (
                    <div
                      key={item.id}
                      className={`p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 transition-opacity duration-150 ${
                        item.included ? 'opacity-100' : 'opacity-60 bg-[#FAF9F6]'
                      }`}
                    >
                      <div className="flex items-start sm:items-center gap-3 min-w-0 flex-1">
                        <ProductThumb src={item.img} alt={item.name} />
                        <div className="min-w-0 flex-1">
                          <h3
                            className={`text-sm font-semibold text-[#18181B] leading-snug ${
                              !item.included ? 'line-through' : ''
                            }`}
                          >
                            {item.name}
                          </h3>

                          <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-[#52525B] tabular-nums">
                            <span>{item.unit}</span>
                            <span aria-hidden="true">·</span>
                            <span className="font-semibold text-[#18181B]">
                              {formatKes(item.price)}
                            </span>
                            {item.usedInDays.length > 0 ? (
                              <>
                                <span aria-hidden="true">·</span>
                                <span className="text-[#15803D] font-medium">
                                  {item.usedInDays.map((d) => `Day ${d}`).join(', ')}
                                </span>
                              </>
                            ) : (
                              <>
                                <span aria-hidden="true">·</span>
                                <span className="text-[#EA580C] font-medium">
                                  Added extra
                                </span>
                              </>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Controls: Swap/Remove + Stepper + Include Toggle */}
                      <div className="flex flex-wrap items-center justify-between sm:justify-end gap-2 pt-2 sm:pt-0 border-t sm:border-t-0 border-[#18181B]/5">
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => openSwapModal(item)}
                            title={`Swap ${item.name} for another ${CATEGORY_LABELS[item.cat]} item`}
                            className="inline-flex items-center gap-1 h-10 px-2.5 rounded-xl border border-[#18181B]/10 bg-[#FAF9F6] hover:bg-white text-xs font-medium text-[#52525B] hover:text-[#18181B] transition-colors duration-150 whitespace-nowrap"
                          >
                            <ArrowUpDown className="h-3.5 w-3.5" />
                            <span>Swap</span>
                          </button>

                          {item.isExtra && (
                            <button
                              type="button"
                              aria-label={`Remove ${item.name}`}
                              onClick={() => onRemoveExtraItem(item.id)}
                              className="h-10 w-10 rounded-xl border border-[#18181B]/10 bg-[#FAF9F6] hover:bg-white flex items-center justify-center text-[#52525B] hover:text-[#9A3412] transition-colors duration-150"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          )}
                        </div>

                        {/* Qty Stepper */}
                        <div className="inline-flex items-center rounded-xl border border-[#18181B]/10 bg-[#FAF9F6]">
                          <button
                            type="button"
                            aria-label={`Decrease quantity for ${item.name}`}
                            disabled={!item.included || item.qty <= 1}
                            onClick={() => onUpdateQty(item.id, -1)}
                            className="h-10 w-10 flex items-center justify-center text-[#18181B] disabled:opacity-35 hover:bg-white rounded-l-xl transition-colors duration-150"
                          >
                            <Minus className="h-3.5 w-3.5" />
                          </button>
                          <span className="w-8 text-center text-sm font-semibold tabular-nums text-[#18181B]">
                            {item.qty}
                          </span>
                          <button
                            type="button"
                            aria-label={`Increase quantity for ${item.name}`}
                            disabled={!item.included || item.qty >= 20}
                            onClick={() => onUpdateQty(item.id, 1)}
                            className="h-10 w-10 flex items-center justify-center text-[#18181B] disabled:opacity-35 hover:bg-white rounded-r-xl transition-colors duration-150"
                          >
                            <Plus className="h-3.5 w-3.5" />
                          </button>
                        </div>

                        {/* Line subtotal on desktop */}
                        <div className="hidden md:block w-20 text-right text-sm font-semibold tabular-nums text-[#18181B]">
                          {item.included ? formatKes(lineTotal) : 'KES 0'}
                        </div>

                        {/* "Already have this?" / Include Toggle */}
                        <button
                          type="button"
                          role="switch"
                          aria-checked={item.included}
                          onClick={() => onToggleInclude(item.id)}
                          className={`h-10 px-3 rounded-xl border text-xs font-medium transition-[border-color,background-color,color,transform] duration-150 ease-[cubic-bezier(0.22,1,0.36,1)] active:scale-[0.98] whitespace-nowrap shrink-0 ${
                            item.included
                              ? item.isPantryStaple
                                ? 'bg-white border-[#18181B]/10 text-[#18181B] hover:border-[#EA580C] hover:text-[#EA580C]'
                                : 'bg-white border-[#15803D]/40 text-[#15803D]'
                              : 'bg-[#FAF9F6] border-[#EA580C] text-[#9A3412]'
                          }`}
                        >
                          {item.included
                            ? item.isPantryStaple
                              ? 'Already have this?'
                              : 'In cart'
                            : 'Have it (excluded)'}
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>
          );
        })}
      </div>

      {/* Add / Swap Zucchini Catalog Drawer Modal */}
      {catalogModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/45 p-0 sm:p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="catalog-modal-title"
        >
          <div className="w-full sm:max-w-lg max-h-[85vh] flex flex-col rounded-t-3xl sm:rounded-3xl border border-[#18181B]/10 bg-white shadow-[0_8px_24px_rgb(0_0_0/0.06)] overflow-hidden">
            <div className="p-5 border-b border-[#18181B]/10 space-y-3">
              <div className="flex items-center justify-between gap-3">
                <h2
                  id="catalog-modal-title"
                  className="font-display text-base font-semibold text-[#18181B] truncate"
                >
                  {swapTarget
                    ? `Swap ${swapTarget.name}`
                    : 'Add item from Zucchini Nairobi'}
                </h2>
                <button
                  type="button"
                  onClick={closeCatalogModal}
                  aria-label="Close product picker"
                  className="h-10 w-10 rounded-xl flex items-center justify-center text-[#52525B] hover:bg-[#FAF9F6] hover:text-[#18181B] shrink-0"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              <div className="relative">
                <Search className="h-4 w-4 text-[#52525B] absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  type="search"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder={
                    swapTarget
                      ? `Search ${CATEGORY_LABELS[swapTarget.cat]}...`
                      : 'Search chicken, oats, avocado, milk...'
                  }
                  aria-label="Search Zucchini catalog"
                  className="w-full h-11 pl-9 pr-3 rounded-xl border border-[#18181B]/15 bg-[#FAF9F6] text-sm text-[#18181B] placeholder:text-[#71717A] focus:outline-none focus:border-[#15803D]"
                />
              </div>

              {!swapTarget && (
                <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
                  <button
                    type="button"
                    onClick={() => setSelectedCategory('all')}
                    className={`h-8 px-3 rounded-lg text-xs font-medium whitespace-nowrap shrink-0 transition-colors ${
                      selectedCategory === 'all'
                        ? 'bg-[#15803D] text-white'
                        : 'bg-[#FAF9F6] text-[#52525B] hover:text-[#18181B]'
                    }`}
                  >
                    All
                  </button>
                  {CATEGORY_ORDER.map((cat) => (
                    <button
                      key={cat}
                      type="button"
                      onClick={() => setSelectedCategory(cat)}
                      className={`h-8 px-3 rounded-lg text-xs font-medium whitespace-nowrap shrink-0 transition-colors ${
                        selectedCategory === cat
                          ? 'bg-[#15803D] text-white'
                          : 'bg-[#FAF9F6] text-[#52525B] hover:text-[#18181B]'
                      }`}
                    >
                      {CATEGORY_LABELS[cat]}
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div className="flex-1 overflow-y-auto divide-y divide-[#18181B]/10 p-2">
              {browseResults.length === 0 ? (
                <div className="py-12 text-center text-sm text-[#52525B]">
                  No matching products found in the Zucchini catalog.
                </div>
              ) : (
                browseResults.map((catItem) => {
                  const alreadyInCart = cartIdSet.has(catItem.id);
                  return (
                    <div
                      key={catItem.id}
                      className="p-3 flex items-center justify-between gap-3"
                    >
                      <div className="flex items-center gap-3 min-w-0 flex-1">
                        <ProductThumb src={catItem.img} alt={catItem.name} />
                        <div className="min-w-0 flex-1">
                          <div className="text-sm font-medium text-[#18181B] truncate">
                            {catItem.name}
                          </div>
                          <div className="text-xs text-[#52525B] tabular-nums">
                            {catItem.unit} · {formatKes(catItem.price)}
                          </div>
                        </div>
                      </div>

                      {swapTarget ? (
                        <button
                          type="button"
                          onClick={() => {
                            onSwapCartItem(swapTarget.id, catItem);
                            closeCatalogModal();
                          }}
                          className="h-9 px-3.5 rounded-xl bg-[#15803D] hover:bg-[#166534] text-white text-xs font-semibold whitespace-nowrap shrink-0"
                        >
                          Use this
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={() => onAddExtraItem(catItem)}
                          className={`h-9 px-3.5 rounded-xl text-xs font-semibold whitespace-nowrap shrink-0 transition-colors ${
                            alreadyInCart
                              ? 'border border-[#15803D]/30 bg-white text-[#15803D] hover:bg-[#FAF9F6]'
                              : 'bg-[#15803D] hover:bg-[#166534] text-white'
                          }`}
                        >
                          {alreadyInCart ? '+1 More' : 'Add'}
                        </button>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      )}

      {/* Live Sticky Summary Bar */}
      <div className="fixed bottom-0 left-0 right-0 z-30 border-t border-[#18181B]/10 bg-[#FAF9F6]">
        <div className="mx-auto max-w-5xl px-4 py-3 flex items-center justify-between gap-3">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-x-2 text-xs text-[#52525B] tabular-nums">
              <span>{activeItems.length} items</span>
              {savedKes > 0 && (
                <>
                  <span aria-hidden="true">·</span>
                  <span className="text-[#15803D] font-medium">
                    Saved {formatKes(savedKes)}
                  </span>
                </>
              )}
            </div>
            <div className="font-display text-base sm:text-lg font-semibold text-[#18181B] tabular-nums">
              Total: {formatKes(totalKes)}
            </div>
          </div>

          <button
            type="button"
            disabled={activeItems.length === 0}
            onClick={onProceedToCheckout}
            className="h-12 px-5 sm:px-6 rounded-xl bg-[#15803D] hover:bg-[#166534] active:scale-[0.98] disabled:opacity-50 text-white font-display font-semibold text-sm sm:text-base inline-flex items-center gap-2 shadow-[0_1px_2px_rgb(0_0_0/0.05)] transition-[background-color,transform] duration-150 ease-[cubic-bezier(0.22,1,0.36,1)] whitespace-nowrap shrink-0"
          >
            <span>Proceed to checkout</span>
            <ArrowRight className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
