"use client";

import { createContext, useContext, useMemo, useState, type ReactNode } from "react";

type NavbarDataState = {
  unreadCount: number;
};

type NavbarDataActions = {
  setUnreadCount: (count: number) => void;
};

const NavbarDataStateContext = createContext<NavbarDataState>({ unreadCount: 0 });
const NavbarDataActionsContext = createContext<NavbarDataActions | null>(null);

export function NavbarProvider({ children }: { children: ReactNode }) {
  const [unreadCount, setUnreadCount] = useState(0);

  const state = useMemo(() => ({ unreadCount }), [unreadCount]);
  const actions = useMemo(() => ({ setUnreadCount }), []);

  return (
    <NavbarDataActionsContext.Provider value={actions}>
      <NavbarDataStateContext.Provider value={state}>{children}</NavbarDataStateContext.Provider>
    </NavbarDataActionsContext.Provider>
  );
}

export function useNavbarDataState() {
  return useContext(NavbarDataStateContext);
}

export function useNavbarDataActions() {
  const actions = useContext(NavbarDataActionsContext);

  if (!actions) {
    return {
      setUnreadCount: () => {},
    };
  }

  return actions;
}
