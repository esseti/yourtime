import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";

export function SettingsNavigation() {
  const pathname = usePathname();

  const tabs = [
    { name: "Categorie", href: "/settings" },
    { name: "App", href: "/settings/apps" },
    { name: "Domini", href: "/settings/domains" },
    { name: "Score", href: "/settings/score" },
    { name: "Calendario", href: "/settings/calendar" },
  ];

  return (
    <div className="flex border-b border-gray-200">
      {tabs.map((tab) => {
        const isActive = pathname === tab.href;
        return (
          <Link
            key={tab.href}
            href={tab.href}
            className={`px-6 py-3 font-medium text-sm transition-colors border-b-2 ${
              isActive
                ? "text-blue-600 border-blue-600"
                : "text-gray-500 hover:text-gray-700 border-transparent"
            }`}
          >
            {tab.name}
          </Link>
        );
      })}
    </div>
  );
}
