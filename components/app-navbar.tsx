"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronDown, LogOut, Menu } from "lucide-react";
import type { Role } from "@/lib/auth/session";
import { isGroupActive, isNavCompact, navForRole, navItems, type NavEntry } from "@/lib/nav";
import { logoutAction } from "@/features/authentication/actions";
import { Button, buttonVariants } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { cn } from "@/lib/utils";

const roleLabel = (role: Role) => (role === "kasir" ? "Kasir" : "Super Admin");

function Brand() {
  return (
    <Link href="/dashboard" className="flex shrink-0 items-center gap-2">
      <span className="flex size-8 items-center justify-center rounded-lg bg-primary text-sm font-bold text-primary-foreground">
        M
      </span>
      <span className="font-semibold">Master Gym</span>
    </Link>
  );
}

function Initials({ name }: { name: string }) {
  return (
    <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-secondary text-xs font-medium text-secondary-foreground">
      {name.slice(0, 2).toUpperCase()}
    </span>
  );
}

const activeClass = "bg-accent text-accent-foreground";
const fullItem = "h-11 px-3 text-base";
const compactItem = "h-11 px-2 text-sm xl:px-3 xl:text-base";

// A real <a> styled like a button: Base UI's Button would give the link role="button".
function NavLink({ entry, active, compact }: {
  entry: NavEntry;
  active: boolean;
  compact: boolean;
}) {
  return (
    <Link
      href={entry.href}
      aria-current={active ? "page" : undefined}
      className={cn(
        buttonVariants({ variant: "ghost" }),
        compact ? compactItem : fullItem,
        active && activeClass,
      )}
    >
      {entry.label}
    </Link>
  );
}

function NavGroup({ label, entries, pathname, compact }: {
  label: string;
  entries: NavEntry[];
  pathname: string;
  compact: boolean;
}) {
  const active = isGroupActive(entries, pathname);
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button
            variant="ghost"
            className={cn("gap-1", compact ? compactItem : fullItem, active && activeClass)}
          />
        }
      >
        {label}
        <ChevronDown className="size-4" />
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-auto min-w-52">
        {entries.map((entry) => (
          <DropdownMenuItem
            key={entry.href}
            className={cn("h-11 text-base", pathname === entry.href && activeClass)}
            render={
              <Link
                href={entry.href}
                aria-current={pathname === entry.href ? "page" : undefined}
              />
            }
          >
            <entry.icon />
            {entry.label}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function UserMenu({ name, email, role }: { name: string; email: string; role: Role }) {
  const compact = isNavCompact(role);
  return (
    <DropdownMenu>
      <DropdownMenuTrigger render={<Button variant="ghost" className="h-11 gap-2 px-2" />}>
        <Initials name={name} />
        <span
          className={cn(
            "hidden flex-col items-start leading-tight",
            compact ? "xl:flex" : "lg:flex",
          )}
        >
          <span className="text-sm font-medium">{name}</span>
          <span className="text-xs text-muted-foreground">{roleLabel(role)}</span>
        </span>
        <ChevronDown className={cn("hidden size-4", compact ? "xl:block" : "lg:block")} />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-auto min-w-56">
        <DropdownMenuGroup>
          <DropdownMenuLabel className="flex flex-col gap-0.5">
            <span className="text-sm font-medium text-foreground">{name}</span>
            <span className="text-xs">{email}</span>
            <span className="text-xs">{roleLabel(role)}</span>
          </DropdownMenuLabel>
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <form action={logoutAction}>
          <DropdownMenuItem
            className="h-11 text-base"
            nativeButton
            render={<button type="submit" className="w-full" />}
          >
            <LogOut />
            Keluar
          </DropdownMenuItem>
        </form>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function MobileMenu({ role, pathname }: { role: Role; pathname: string }) {
  const [open, setOpen] = useState(false);
  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger
        render={<Button variant="ghost" size="icon-lg" className="size-11" aria-label="Buka menu" />}
      >
        <Menu className="size-5" />
      </SheetTrigger>
      <SheetContent side="left" className="w-72 gap-0 overflow-y-auto p-4">
        <SheetTitle className="mb-2">Menu</SheetTitle>
        {navForRole(role).map((section, i) => (
          <div key={section.label ?? i} className="py-2">
            {section.label && (
              <p className="px-2 pb-1 text-xs font-medium text-muted-foreground">
                {section.label}
              </p>
            )}
            {section.entries.map((entry) => {
              const active = pathname === entry.href;
              return (
                <Link
                  key={entry.href}
                  href={entry.href}
                  onClick={() => setOpen(false)}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "flex h-11 items-center gap-2 rounded-md px-2 text-base hover:bg-accent",
                    active && activeClass,
                  )}
                >
                  <entry.icon className="size-4" />
                  {entry.label}
                </Link>
              );
            })}
          </div>
        ))}
      </SheetContent>
    </Sheet>
  );
}

export function AppNavbar({ name, email, role }: { name: string; email: string; role: Role }) {
  const pathname = usePathname();
  const items = navItems(navForRole(role));
  const compact = isNavCompact(role);

  return (
    <header className="sticky top-0 z-40 border-b bg-background">
      <div className="flex h-14 items-center gap-2 px-4">
        <div className="lg:hidden">
          <MobileMenu role={role} pathname={pathname} />
        </div>
        <Brand />
        <nav
          aria-label="Menu utama"
          className={cn("hidden items-center gap-1 lg:flex", compact ? "ml-2 xl:ml-4" : "ml-4")}
        >
          {items.map((item) =>
            item.kind === "link" ? (
              <NavLink
                key={item.entry.href}
                entry={item.entry}
                active={pathname === item.entry.href}
                compact={compact}
              />
            ) : (
              <NavGroup
                key={item.label}
                label={item.label}
                entries={item.entries}
                pathname={pathname}
                compact={compact}
              />
            ),
          )}
        </nav>
        <div className="ml-auto">
          <UserMenu name={name} email={email} role={role} />
        </div>
      </div>
    </header>
  );
}
