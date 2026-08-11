"use client";

/* Front-end cart (Sprint 03). Client-only state, persisted to localStorage — NO checkout
   backend yet (deferred by decision 2026-07-16). Wraps the whole app from layout.tsx so
   Nav's bag indicator and the CartDrawer share one source of truth on every route.
   SSR-safe: starts empty, hydrates from storage in an effect (no hydration mismatch). */

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";

export type CartItem = {
  slug: string;
  name: string;
  size: string; // size label, e.g. "100 ml"
  ml: number;
  sku: string;
  price: number | null; // null = price not set yet (placeholder era)
  qty: number;
};

type CartCtx = {
  items: CartItem[];
  count: number;
  subtotal: number | null; // null if any line has no price
  hasUnpriced: boolean;
  add: (item: Omit<CartItem, "qty">, qty?: number) => void;
  setQty: (sku: string, qty: number) => void;
  remove: (sku: string) => void;
  /** Emptied once an order exists — see app/order/[token]/ClearBagOnPlaced.tsx. */
  clear: () => void;
  open: boolean;
  setOpen: (o: boolean) => void;
};

const Ctx = createContext<CartCtx | null>(null);
const KEY = "btb-cart-v1";

export function CartProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<CartItem[]>([]);
  const [open, setOpen] = useState(false);
  const [hydrated, setHydrated] = useState(false);

  // hydrate once from storage
  useEffect(() => {
    try {
      const raw = localStorage.getItem(KEY);
      /* eslint-disable-next-line react-hooks/set-state-in-effect --
         This is the case the rule cannot express: a one-shot read of an external store
         (localStorage) AFTER hydration. It cannot move into useState's initialiser — the
         server has no localStorage, so the server would render an empty bag and the client
         a full one, which is a hydration mismatch rather than a fix. useSyncExternalStore
         is the by-the-book alternative and would rewrite the storage layer of a working
         cart to satisfy a lint rule, changing no behaviour. */
      if (raw) setItems(JSON.parse(raw));
    } catch {
      /* ignore corrupt storage */
    }
    setHydrated(true);
  }, []);

  // persist after hydration
  useEffect(() => {
    if (!hydrated) return;
    try {
      localStorage.setItem(KEY, JSON.stringify(items));
    } catch {
      /* storage full / unavailable — non-fatal */
    }
  }, [items, hydrated]);

  const add = useCallback((item: Omit<CartItem, "qty">, qty = 1) => {
    setItems((prev) => {
      const i = prev.findIndex((p) => p.sku === item.sku);
      if (i >= 0) {
        const next = [...prev];
        next[i] = { ...next[i], qty: next[i].qty + qty };
        return next;
      }
      return [...prev, { ...item, qty }];
    });
    setOpen(true); // reveal the drawer on add
  }, []);

  const setQty = useCallback((sku: string, qty: number) => {
    setItems((prev) =>
      qty <= 0
        ? prev.filter((p) => p.sku !== sku)
        : prev.map((p) => (p.sku === sku ? { ...p, qty } : p))
    );
  }, []);

  const remove = useCallback((sku: string) => {
    setItems((prev) => prev.filter((p) => p.sku !== sku));
  }, []);

  /* Clears storage as well as state, and that is load-bearing rather than tidy.
     A child's effect runs BEFORE its parent's, so the order confirmation page calls this
     while `hydrated` is still false — and the hydrate effect above would then read the
     old bag straight back out of storage and restore it. The customer would land on
     "thank you for your order" with the order still in their bag, and quite reasonably
     buy it again. Removing the key means hydration finds nothing whichever order the two
     effects run in. */
  const clear = useCallback(() => {
    try {
      localStorage.removeItem(KEY);
    } catch {
      /* storage unavailable — the state reset below is still correct */
    }
    setItems([]);
  }, []);

  const count = items.reduce((n, p) => n + p.qty, 0);
  const hasUnpriced = items.some((p) => p.price == null);
  const subtotal = hasUnpriced
    ? null
    : items.reduce((s, p) => s + (p.price || 0) * p.qty, 0);

  return (
    <Ctx.Provider
      value={{ items, count, subtotal, hasUnpriced, add, setQty, remove, clear, open, setOpen }}
    >
      {children}
    </Ctx.Provider>
  );
}

export function useCart(): CartCtx {
  const c = useContext(Ctx);
  if (!c) throw new Error("useCart must be used within <CartProvider>");
  return c;
}
