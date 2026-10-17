"use client";

import * as React from "react";
import { Check, ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

export type WizardStepDef = {
  key: string;
  label: string;
};

export function onWizardEnterAdvance(onNext: () => void) {
  return (e: React.KeyboardEvent<HTMLElement>) => {
    if (e.key !== "Enter") return;
    const tag = (e.target as HTMLElement).tagName;
    if (tag === "TEXTAREA" || tag === "BUTTON") return;
    e.preventDefault();
    onNext();
  };
}

export function useWizard(steps: WizardStepDef[]) {
  const [index, setIndex] = React.useState(0);

  const goNext = React.useCallback(() => {
    setIndex((i) => Math.min(i + 1, steps.length - 1));
  }, [steps.length]);

  const goBack = React.useCallback(() => {
    setIndex((i) => Math.max(i - 1, 0));
  }, []);

  const goTo = React.useCallback(
    (i: number) => {
      setIndex(Math.max(0, Math.min(i, steps.length - 1)));
    },
    [steps.length],
  );

  const reset = React.useCallback(() => setIndex(0), []);

  return {
    index,
    step: steps[index],
    steps,
    isFirst: index === 0,
    isLast: index === steps.length - 1,
    goNext,
    goBack,
    goTo,
    reset,
  };
}

export function WizardStepIndicator({
  steps,
  currentIndex,
  className,
}: {
  steps: WizardStepDef[];
  currentIndex: number;
  className?: string;
}) {
  return (
    <div className={cn("w-full", className)}>
      <p className="mb-2 text-sm font-medium text-muted-foreground">
        Langkah {currentIndex + 1} dari {steps.length}: {steps[currentIndex]?.label}
      </p>
      <ol className="flex w-full items-start">
        {steps.map((s, i) => {
          const state =
            i < currentIndex ? "done" : i === currentIndex ? "current" : "upcoming";
          const lineDone = state === "done";
          return (
            <li key={s.key} className="flex flex-1 flex-col items-center">
              <div className="flex w-full items-center">
                <div
                  className={cn(
                    "h-0.5 flex-1",
                    i === 0 ? "invisible" : lineDone ? "bg-success" : "bg-border",
                  )}
                  aria-hidden
                />
                <div
                  className={cn(
                    "flex size-8 shrink-0 items-center justify-center rounded-full border-2 text-sm font-semibold",
                    state === "done" &&
                      "border-success bg-success text-success-foreground",
                    state === "current" &&
                      "border-primary bg-primary text-primary-foreground",
                    state === "upcoming" &&
                      "border-border bg-background text-muted-foreground",
                  )}
                  aria-current={state === "current" ? "step" : undefined}
                >
                  {state === "done" ? <Check className="size-4" /> : i + 1}
                </div>
                <div
                  className={cn(
                    "h-0.5 flex-1",
                    i === steps.length - 1
                      ? "invisible"
                      : i < currentIndex
                        ? "bg-success"
                        : "bg-border",
                  )}
                  aria-hidden
                />
              </div>
              <span
                className={cn(
                  "mt-1.5 hidden text-center text-xs leading-tight sm:block",
                  state === "current"
                    ? "font-semibold text-foreground"
                    : "text-muted-foreground",
                )}
              >
                {s.label}
              </span>
            </li>
          );
        })}
      </ol>
    </div>
  );
}

export function WizardStep({
  title,
  description,
  children,
  className,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("space-y-4", className)}>
      <div>
        <h3 className="text-lg font-semibold text-foreground">{title}</h3>
        {description && (
          <p className="mt-0.5 text-sm text-muted-foreground">{description}</p>
        )}
      </div>
      {children}
    </div>
  );
}

export function WizardNav({
  isFirst,
  isLast,
  onBack,
  onNext,
  submitLabel = "Simpan",
  pending,
}: {
  isFirst: boolean;
  isLast: boolean;
  onBack: () => void;
  onNext: () => void;
  submitLabel?: string;
  pending?: boolean;
}) {
  return (
    <div className="flex items-center justify-between gap-3 border-t pt-4">
      <div className="flex items-center gap-2">
        {!isFirst && (
          <Button type="button" variant="outline" size="xl" onClick={onBack} disabled={pending}>
            <ChevronLeft />
            Kembali
          </Button>
        )}
      </div>
      <Button
        type="button"
        variant={isLast ? "success" : "default"}
        size="xl"
        onClick={onNext}
        disabled={pending}
      >
        {pending ? "Menyimpan..." : isLast ? submitLabel : "Lanjut"}
        {!isLast && !pending && <ChevronRight />}
      </Button>
    </div>
  );
}
