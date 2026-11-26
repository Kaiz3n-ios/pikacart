import { useMemo, useRef, useState } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  ArrowUpDown,
  Check,
  Copy,
  Minus,
  Package,
  Plus,
  Search,
  Trash2,
  X,
} from 'lucide-react';
import type { CartItem, CatalogCategory, CatalogItem, Meal } from '../types';
import {
  buildWhatsAppShoppingList,
  CATALOG,
  CATEGORY_LABELS,
  CATEGORY_ORDER,
  formatKes,
} from '../utils/catalogHelper';
import { useModalFocusTrap } from '../hooks/useModalFocusTrap';

interface CartViewProps {
  items: CartItem[];
  meals: Meal[];
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
      <div className="h-12 w-12 shrink-0 rounded-xl border border-[var(--border)] bg-[var(--surface-elevated)] flex items-center justify-center text-[var(--text-muted)]">
        <Package className="h-5 w-5" aria-hidden="true" />
      </div>
    );
  }

  return (
    <img
      src={src}
      alt={alt}
      loading="lazy"
      referrerPolicy="no-referrer"
      onError={() => setFailed(true)}
      className="h-12 w-12 shrink-0 rounded-xl border border-[var(--border)] bg-white object-cover"
    />
  );
}

export function CartView({
  items,
  meals,
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
  const [copiedList, setCopiedList] = useState(false);

  const modalDialogRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

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

  useModalFocusTrap(catalogModalOpen, modalDialogRef, closeCatalogModal, searchInputRef);

  const handleCopyShoppingList = async () => {
    if (activeItems.length === 0) return;
    const text = buildWhatsAppShoppingList(items, meals);
    try {
      await navigator.clipboard.writeText(text);
      setCopiedList(true);
      window.setTimeout(() => setCopiedList(false), 2600);
    } catch {
      const textarea = document.createElement('textarea');
      textarea.value = text;
      textarea.style.position = 'fixed';
      textarea.style.opacity = '0';
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand('copy');
      document.body.removeChild(textarea);
      setCopiedList(true);
      window.setTimeout(() => setCopiedList(false), 2600);
    }
  };

  return (
    <div className="space-y-6 pb-24">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <button
            type="button"
            onClick={onBackToMenu}
            className="inline-flex items-center gap-1.5 min-h-[44px] pr-2 text-xs font-medium text-[var(--text-muted)] hover:text-[var(--text)] mb-1 transition-colors duration-150 rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-basil)]"
          >
            <ArrowLeft className="h-3.5 w-3.5" aria-hidden="true" />
            <span>Back to menu</span>
          </button>
          <h1 className="font-display text-2xl sm:text-3xl font-semibold tracking-tight text-[var(--text)] text-balance">
            Grocery cart
          </h1>
          <p className="mt-1 text-sm text-[var(--text-muted)]">
            Quantities scale to your household. Turn off spices you already own or swap items.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 shrink-0">
          {pantryItems.length > 0 && (
            <button
              type="button"
              onClick={onExcludeAllPantry}
              aria-pressed={allPantryExcluded}
              className={`inline-flex items-center gap-2 h-11 px-4 rounded-xl border text-xs sm:text-sm font-medium transition-[border-color,background-color,color,transform] duration-150 ease-[cubic-bezier(0.22,1,0.36,1)] active:scale-[0.98] whitespace-nowrap focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-basil)] ${
                allPantryExcluded
                  ? 'bg-[var(--accent-basil-tint)] border-[var(--accent-basil-border)] text-[var(--accent-basil)]'
                  : 'bg-[var(--surface)] border-[var(--border)] hover:border-[var(--accent-ember-border)] text-[var(--text)]'
              }`}
            >
              <Check
                aria-hidden="true"
                className={`h-4 w-4 ${
                  allPantryExcluded
                    ? 'text-[var(--accent-basil)]'
                    : 'text-[var(--accent-ember)]'
                }`}
              />
              <span>
                {allPantryExcluded
                  ? 'Spices & oils excluded'
                  : `Exclude spices & oils I already own (${formatKes(includedPantryTotal)})`}
              </span>
            </button>
          )}

          <button
            type="button"
            disabled={activeItems.length === 0}
            onClick={handleCopyShoppingList}
            className="inline-flex items-center gap-1.5 h-11 px-4 rounded-xl border border-[var(--border)] bg-[var(--surface)] hover:border-[var(--accent-basil-border)] disabled:opacity-45 text-[var(--text)] text-xs sm:text-sm font-medium transition-[border-color,transform] duration-150 ease-[cubic-bezier(0.22,1,0.36,1)] active:scale-[0.98] whitespace-nowrap focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-basil)]"
          >
            {copiedList ? (
              <>
                <Check className="h-4 w-4 text-[var(--accent-basil)]" aria-hidden="true" />
                <span className="text-[var(--accent-basil)]">List copied</span>
              </>
            ) : (
              <>
                <Copy className="h-4 w-4 text-[var(--text-muted)]" aria-hidden="true" />
                <span>Copy list</span>
              </>
            )}
          </button>

          <button
            type="button"
            onClick={openAddModal}
            className="inline-flex items-center gap-1.5 h-11 px-4 rounded-xl border border-[var(--border)] bg-[var(--surface)] hover:border-[var(--accent-basil-border)] text-[var(--text)] text-xs sm:text-sm font-medium transition-[border-color,transform] duration-150 ease-[cubic-bezier(0.22,1,0.36,1)] active:scale-[0.98] whitespace-nowrap focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-basil)]"
          >
            <Plus className="h-4 w-4 text-[var(--accent-basil)]" aria-hidden="true" />
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
                <h2 className="font-display text-sm font-semibold text-[var(--text)]">
                  {CATEGORY_LABELS[cat]}
                </h2>
                <span className="text-xs text-[var(--text-muted)] tabular-nums">
                  {catItems.filter((i) => i.included).length} of {catItems.length} in cart
                </span>
              </div>

              <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] divide-y divide-[var(--border)] overflow-hidden">
                {catItems.map((item) => {
                  const lineTotal = item.price * item.qty;
                  return (
                    <div
                      key={item.id}
                      className={`p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 transition-opacity duration-150 ${
                        item.included ? 'opacity-100' : 'opacity-65 bg-[var(--surface-elevated)]'
                      }`}
                    >
                      <div className="flex items-start sm:items-center gap-3 min-w-0 flex-1">
                        <ProductThumb src={item.img} alt={item.name} />
                        <div className="min-w-0 flex-1">
                          <h3
                            className={`text-sm font-semibold text-[var(--text)] leading-snug ${
                              !item.included ? 'line-through' : ''
                            }`}
                          >
                            {item.name}
                          </h3>

                          <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-[var(--text-muted)] tabular-nums">
                            <span>{item.unit}</span>
                            <span aria-hidden="true">·</span>
                            <span className="font-semibold text-[var(--text)]">
                              {formatKes(item.price)}
                            </span>
                            {item.usedInDays.length > 0 ? (
                              <span className="inline-flex items-center rounded-md bg-[var(--accent-basil-tint)] px-1.5 py-0.5 text-xs font-medium text-[var(--accent-basil)]">
                                {item.usedInDays.map((d) => `Day ${d}`).join(', ')}
                              </span>
                            ) : (
                              <span className="inline-flex items-center rounded-md bg-[var(--accent-ember-tint)] px-1.5 py-0.5 text-xs font-medium text-[var(--accent-ember)]">
                                Added extra
                              </span>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Controls: Swap/Remove + Stepper + Include Toggle */}
                      <div className="flex flex-wrap items-center justify-between sm:justify-end gap-2 pt-2 sm:pt-0 border-t sm:border-t-0 border-[var(--border)]">
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => openSwapModal(item)}
                            title={`Swap ${item.name} for another ${CATEGORY_LABELS[item.cat]} item`}
                            className="inline-flex items-center gap-1 h-11 sm:h-10 px-3 rounded-xl border border-[var(--border)] bg-[var(--surface-elevated)] hover:border-[var(--text-muted)] text-xs font-medium text-[var(--text-muted)] hover:text-[var(--text)] transition-colors duration-150 whitespace-nowrap focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-basil)]"
                          >
                            <ArrowUpDown className="h-3.5 w-3.5" aria-hidden="true" />
                            <span>Swap</span>
                          </button>

                          {item.isExtra && (
                            <button
                              type="button"
                              aria-label={`Remove ${item.name}`}
                              onClick={() => onRemoveExtraItem(item.id)}
                              className="h-11 w-11 sm:h-10 sm:w-10 rounded-xl border border-[var(--border)] bg-[var(--surface-elevated)] hover:border-[var(--accent-ember-border)] flex items-center justify-center text-[var(--text-muted)] hover:text-[var(--accent-ember)] transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-ember)]"
                            >
                              <Trash2 className="h-4 w-4" aria-hidden="true" />
                            </button>
                          )}
                        </div>

                        {/* Qty Stepper */}
                        <div className="inline-flex items-center rounded-xl border border-[var(--border)] bg-[var(--surface-elevated)]">
                          <button
                            type="button"
                            aria-label={`Decrease quantity for ${item.name}`}
                            disabled={!item.included || item.qty <= 1}
                            onClick={() => onUpdateQty(item.id, -1)}
                            className="h-11 w-11 sm:h-10 sm:w-10 flex items-center justify-center text-[var(--text)] disabled:opacity-35 hover:bg-black/5 rounded-l-xl transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-basil)]"
                          >
                            <Minus className="h-3.5 w-3.5" aria-hidden="true" />
                          </button>
                          <span className="w-8 text-center text-sm font-semibold tabular-nums text-[var(--text)]">
                            {item.qty}
                          </span>
                          <button
                            type="button"
                            aria-label={`Increase quantity for ${item.name}`}
                            disabled={!item.included || item.qty >= 20}
                            onClick={() => onUpdateQty(item.id, 1)}
                            className="h-11 w-11 sm:h-10 sm:w-10 flex items-center justify-center text-[var(--text)] disabled:opacity-35 hover:bg-black/5 rounded-r-xl transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-basil)]"
                          >
                            <Plus className="h-3.5 w-3.5" aria-hidden="true" />
                          </button>
                        </div>

                        {/* Line subtotal on desktop */}
                        <div className="hidden md:block w-20 text-right text-sm font-semibold tabular-nums text-[var(--text)]">
                          {item.included ? formatKes(lineTotal) : 'KES 0'}
                        </div>

                        {/* "Already have this?" / Include Toggle */}
                        <button
                          type="button"
                          role="switch"
                          aria-checked={item.included}
                          onClick={() => onToggleInclude(item.id)}
                          className={`h-11 sm:h-10 px-3 rounded-xl border text-xs font-medium transition-[border-color,background-color,color,transform] duration-150 ease-[cubic-bezier(0.22,1,0.36,1)] active:scale-[0.98] whitespace-nowrap shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-basil)] ${
                            item.included
                              ? item.isPantryStaple
                                ? 'bg-[var(--surface-elevated)] border-[var(--border)] text-[var(--text)] hover:border-[var(--accent-ember-border)] hover:text-[var(--accent-ember)]'
                                : 'bg-[var(--accent-basil-tint)] border-[var(--accent-basil-border)] text-[var(--accent-basil)]'
                              : 'bg-[var(--accent-ember-tint)] border-[var(--accent-ember-border)] text-[var(--accent-ember)]'
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
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/55 p-0 sm:p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="catalog-modal-title"
          onClick={(e) => {
            if (e.target === e.currentTarget) closeCatalogModal();
          }}
        >
          <div
            ref={modalDialogRef}
            tabIndex={-1}
            className="w-full sm:max-w-lg max-h-[85vh] flex flex-col rounded-t-3xl sm:rounded-3xl border border-[var(--border)] bg-[var(--surface)] shadow-[0_8px_24px_rgb(0_0_0/0.06)] overflow-hidden focus:outline-none"
          >
            <div className="p-5 border-b border-[var(--border)] space-y-3">
              <div className="flex items-center justify-between gap-3">
                <h2
                  id="catalog-modal-title"
                  className="font-display text-base font-semibold text-[var(--text)] truncate"
                >
                  {swapTarget
                    ? `Swap ${swapTarget.name}`
                    : 'Add item from Zucchini Nairobi'}
                </h2>
                <button
                  type="button"
                  onClick={closeCatalogModal}
                  aria-label="Close product picker"
                  className="h-11 w-11 rounded-xl flex items-center justify-center text-[var(--text-muted)] hover:bg-[var(--surface-elevated)] hover:text-[var(--text)] shrink-0 transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-basil)]"
                >
                  <X className="h-4 w-4" aria-hidden="true" />
                </button>
              </div>

              <div className="relative">
                <label htmlFor="catalog-search-input" className="sr-only">
                  Search Zucchini catalog
                </label>
                <Search
                  className="h-4 w-4 text-[var(--text-muted)] absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none"
                  aria-hidden="true"
                />
                <input
                  ref={searchInputRef}
                  id="catalog-search-input"
                  type="search"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder={
                    swapTarget
                      ? `Search ${CATEGORY_LABELS[swapTarget.cat]}...`
                      : 'Search chicken, oats, avocado, milk...'
                  }
                  className="w-full h-11 pl-9 pr-3 rounded-xl border border-[var(--border)] bg-[var(--surface-elevated)] text-sm text-[var(--text)] placeholder:text-[var(--text-muted)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-basil)] focus-visible:border-[var(--accent-basil)]"
                />
              </div>

              {!swapTarget && (
                <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
                  <button
                    type="button"
                    aria-pressed={selectedCategory === 'all'}
                    onClick={() => setSelectedCategory('all')}
                    className={`h-11 sm:h-9 px-3 rounded-lg text-xs font-medium whitespace-nowrap shrink-0 transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-basil)] ${
                      selectedCategory === 'all'
                        ? 'bg-[var(--accent-basil-solid)] text-white'
                        : 'bg-[var(--surface-elevated)] text-[var(--text-muted)] hover:text-[var(--text)]'
                    }`}
                  >
                    All
                  </button>
                  {CATEGORY_ORDER.map((cat) => (
                    <button
                      key={cat}
                      type="button"
                      aria-pressed={selectedCategory === cat}
                      onClick={() => setSelectedCategory(cat)}
                      className={`h-11 sm:h-9 px-3 rounded-lg text-xs font-medium whitespace-nowrap shrink-0 transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-basil)] ${
                        selectedCategory === cat
                          ? 'bg-[var(--accent-basil-solid)] text-white'
                          : 'bg-[var(--surface-elevated)] text-[var(--text-muted)] hover:text-[var(--text)]'
                      }`}
                    >
                      {CATEGORY_LABELS[cat]}
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div className="flex-1 overflow-y-auto divide-y divide-[var(--border)] p-2">
              {browseResults.length === 0 ? (
                <div className="py-12 text-center text-sm text-[var(--text-muted)]">
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
                          <div className="text-sm font-medium text-[var(--text)] truncate">
                            {catItem.name}
                          </div>
                          <div className="text-xs text-[var(--text-muted)] tabular-nums">
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
                          className="h-11 sm:h-9 px-3.5 rounded-xl bg-[var(--accent-basil-solid)] hover:bg-[var(--accent-basil-solid-hover)] text-white text-xs font-semibold whitespace-nowrap shrink-0 transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-basil)]"
                        >
                          Use this
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={() => onAddExtraItem(catItem)}
                          className={`h-11 sm:h-9 px-3.5 rounded-xl text-xs font-semibold whitespace-nowrap shrink-0 transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-basil)] ${
                            alreadyInCart
                              ? 'border border-[var(--accent-basil-border)] bg-[var(--accent-basil-tint)] text-[var(--accent-basil)]'
                              : 'bg-[var(--accent-basil-solid)] hover:bg-[var(--accent-basil-solid-hover)] text-white'
                          }`}
                        >
                          {alreadyInCart ? '+1 more' : 'Add'}
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
      <div className="fixed bottom-0 left-0 right-0 z-30 border-t border-[var(--border)] bg-[var(--bg)]">
        <div className="mx-auto max-w-5xl px-4 py-3 flex items-center justify-between gap-3">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-x-2 text-xs text-[var(--text-muted)] tabular-nums">
              <span>{activeItems.length} items</span>
              {savedKes > 0 && (
                <>
                  <span aria-hidden="true">·</span>
                  <span className="text-[var(--accent-basil)] font-medium">
                    Saved {formatKes(savedKes)}
                  </span>
                </>
              )}
            </div>
            <div className="font-display text-base sm:text-lg font-semibold text-[var(--text)] tabular-nums">
              Total: {formatKes(totalKes)}
            </div>
          </div>

          <button
            type="button"
            disabled={activeItems.length === 0}
            onClick={onProceedToCheckout}
            className="h-12 px-5 sm:px-6 rounded-xl bg-[var(--accent-basil-solid)] hover:bg-[var(--accent-basil-solid-hover)] active:scale-[0.98] disabled:opacity-50 text-white font-display font-semibold text-sm sm:text-base inline-flex items-center gap-2 shadow-[0_1px_2px_rgb(0_0_0/0.05)] transition-[background-color,transform] duration-150 ease-[cubic-bezier(0.22,1,0.36,1)] whitespace-nowrap shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-basil)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--bg)]"
          >
            <span>Proceed to checkout</span>
            <ArrowRight className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>
      </div>
    </div>
  );
}
