"use client";

/* Empties the bag once the order is known to exist.
 *
 * Deliberately here and not in the checkout form: clearing before navigating would lose
 * somebody's bag if the navigation then failed. By the time this renders, the order is in
 * the database and the confirmation email is queued — the bag has done its job. */

import { useEffect } from "react";
import { useCart } from "@/app/_components/CartProvider";

export default function ClearBagOnPlaced() {
  const { clear } = useCart();

  useEffect(() => {
    clear();
  }, [clear]);

  return null;
}
