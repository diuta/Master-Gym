"use client";

import { useMemo, useState } from "react";

type SortDir = "asc" | "desc";
export type SortState = { key: string; dir: SortDir } | null;

export function useSort<T>(
  rows: T[],
  getValue: (row: T, key: string) => string | number,
) {
  const [sort, setSort] = useState<SortState>(null);

  const sortedRows = useMemo(() => {
    if (!sort) return rows;
    const { key, dir } = sort;
    const copy = [...rows];
    copy.sort((a, b) => {
      const va = getValue(a, key);
      const vb = getValue(b, key);
      let cmp: number;
      if (typeof va === "number" && typeof vb === "number") {
        cmp = va - vb;
      } else {
        cmp = String(va).localeCompare(String(vb), "id-ID");
      }
      return dir === "asc" ? cmp : -cmp;
    });
    return copy;
  }, [rows, sort, getValue]);

  function toggleSort(key: string) {
    setSort((prev) => {
      if (!prev || prev.key !== key) return { key, dir: "asc" };
      if (prev.dir === "asc") return { key, dir: "desc" };
      return null;
    });
  }

  return { sortedRows, sort, toggleSort };
}
