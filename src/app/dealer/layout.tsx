"use client";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { Suspense } from "react";

function DealerNav() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const dealerId = searchParams.get("id") || "1";

  if (pathname === "/dealer/login") return null;

  const navItems = [
    { href: `/dealer?id=${dealerId}`, label: "Home", icon: "M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6", match: "/dealer" },
    { href: `/dealer/schemes?id=${dealerId}`, label: "Schemes", icon: "M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01", match: "/dealer/schemes" },
    { href: `/dealer/incentives?id=${dealerId}`, label: "Rewards", icon: "M12 8v13m0-13V6a2 2 0 112 2h-2zm0 0V5.5A2.5 2.5 0 109.5 8H12zm-7 4h14M5 12a2 2 0 110-4h14a2 2 0 110 4M5 12v7a2 2 0 002 2h10a2 2 0 002-2v-7", match: "/dealer/incentives" },
    { href: `/dealer/what-if?id=${dealerId}`, label: "Calculator", icon: "M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z", match: "/dealer/what-if" },
  ];

  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 z-50 safe-area-bottom">
      <div className="max-w-lg mx-auto flex items-center justify-around py-2">
        {navItems.map(item => {
          const isActive = pathname === item.match || (item.match !== "/dealer" && pathname.startsWith(item.match));
          const isExactHome = item.match === "/dealer" && pathname === "/dealer";
          const active = isActive || isExactHome;
          return (
            <Link key={item.href} href={item.href}
              className={`flex flex-col items-center gap-1 px-4 py-1 rounded-xl transition-colors ${active ? "text-[#f47920]" : "text-gray-400"}`}>
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={active ? 2.5 : 1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d={item.icon} />
              </svg>
              <span className="text-[10px] font-semibold">{item.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}

export default function DealerLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-gray-50 max-w-lg mx-auto relative pb-20">
      <Suspense fallback={null}>
        {children}
        <DealerNav />
      </Suspense>
    </div>
  );
}
