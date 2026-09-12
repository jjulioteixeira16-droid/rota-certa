"use client";

import { usePathname } from "next/navigation";

const LINKS = [
  { href: "/dashboard", label: "Início" },
  { href: "/bairros", label: "Bairros" },
  { href: "/motoboys", label: "Motoboys" },
  { href: "/lancamentos", label: "Lançamentos" },
  { href: "/fechamento", label: "Fechamento" },
];

export default function AppShell({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  const pathname = usePathname();

  return (
    <main className="min-h-screen bg-[#f4efe6]">
      <header className="bg-stone-900 text-white">
        <div className="max-w-5xl mx-auto px-4 py-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <a href="/dashboard" className="font-bold text-lg tracking-tight">
            Rota Certa
          </a>
          <nav className="flex flex-wrap gap-2">
            {LINKS.map((link) => {
              const ativo = pathname === link.href;
              return (
                <a
                  key={link.href}
                  href={link.href}
                  className={
                    ativo
                      ? "rounded-full bg-orange-500 px-3 py-1.5 text-sm font-medium text-white"
                      : "rounded-full px-3 py-1.5 text-sm text-stone-200 hover:bg-stone-800"
                  }
                >
                  {link.label}
                </a>
              );
            })}
          </nav>
        </div>
      </header>

      <div className="max-w-5xl mx-auto p-4 sm:p-6">
        <div className="bg-white rounded-2xl shadow-sm border border-stone-200 p-5 sm:p-6">
          <h1 className="text-2xl font-bold mb-5">{title}</h1>
          {children}
        </div>
      </div>
    </main>
  );
}