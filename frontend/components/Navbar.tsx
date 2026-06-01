"use client";

import dynamic from "next/dynamic";
import { NavbarProvider } from "./NavbarContext";
import { NavbarShell } from "./NavbarShell";

const NavbarData = dynamic(() => import("./NavbarData"), {
  ssr: false,
});

export function Navbar() {
  return (
    <NavbarProvider>
      <NavbarShell />
      <NavbarData />
    </NavbarProvider>
  );
}
