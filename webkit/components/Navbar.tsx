import { Link, useNavigation } from "react-router-dom";
import { useEffect, useState } from "react";
import classnames from "classnames";
import { Menu, X, ChevronDown } from "lucide-react";

type NavItem = {
  name: string;
  path: string;
};

type NavGroup = {
  label: string;
  items: NavItem[];
};

const navigationGroups: (NavItem | NavGroup)[] = [
  { name: "Main", path: "/application/main" },
  { name: "Accounts", path: "/application/accounts" },
  {
    label: "Audience",
    items: [
      { name: "Chats", path: "/application/audience/chats" },
      { name: "Lookalike Users", path: "/application/audience/lookalike-users" },
    ],
  },
  {
    label: "Campaigns",
    items: [
      { name: "Ad Campaigns", path: "/application/campaigns" },
      { name: "Artifacts", path: "/application/campaigns/artifacts" },
    ],
  },
  { name: "Proxies", path: "/application/proxies" },
  { name: "Import", path: "/application/import" },
];

function isActive(path: string, currentPath: string): boolean {
  if (path === "/application/main") return currentPath === "/" || currentPath === "/application/main";
  return currentPath === path || currentPath.startsWith(path + "/");
}

export default function Navbar() {
  const [currentPath, setCurrentPath] = useState(window.location.pathname);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [openDropdowns, setOpenDropdowns] = useState<Set<string>>(new Set());

  useEffect(() => {
    const func = (event: NavigateEvent) => {
      const uri = new URL(event.destination.url);
      setCurrentPath(uri.pathname);
      setMobileOpen(false);
    };
    if (window.navigation) {
      window.navigation.addEventListener("navigate", func);
    }
    return () => {
      if (window.navigation) {
        window.navigation.removeEventListener("navigate", func);
      }
    };
  }, []);

  const toggleDropdown = (label: string) => {
    setOpenDropdowns((prev) => {
      const next = new Set(prev);
      if (next.has(label)) next.delete(label);
      else next.add(label);
      return next;
    });
  };

  const closeAll = () => {
    setMobileOpen(false);
    setOpenDropdowns(new Set());
  };

  return (
    <nav className="bg-black text-white/80 sticky top-0 z-50">
      <div className="container mx-auto px-4">
        <div className="flex items-center justify-between h-10">
          {/* Brand */}
          <Link
            to="/application/main"
            className="flex items-center gap-2 shrink-0 select-none"
          >
            <span className="text-sm tracking-tight text-white/90 font-medium">TON</span>
            <span className="hidden sm:inline text-xs text-white/40">dashboard</span>
          </Link>

          {/* Desktop nav */}
          <ul className="hidden lg:flex items-center gap-5 h-full">
            {navigationGroups.map((item) => {
              if ("path" in item) {
                const active = isActive(item.path, currentPath);
                return (
                  <li key={item.path} className="h-full flex items-center">
                    <Link
                      to={item.path}
                      className={classnames(
                        "relative text-xs tracking-wide transition-colors",
                        active
                          ? "text-white"
                          : "text-white/50 hover:text-white/80"
                      )}
                    >
                      {item.name}
                      {active && (
                        <span className="absolute -bottom-3 left-0 right-0 h-px bg-white/70" />
                      )}
                    </Link>
                  </li>
                );
              }

              const isOpen = openDropdowns.has(item.label);
              const hasActive = item.items.some((sub) => isActive(sub.path, currentPath));

              return (
                <li key={item.label} className="h-full flex items-center">
                  <div className="group relative h-full flex items-center">
                    <button
                      onClick={() => toggleDropdown(item.label)}
                      className={classnames(
                        "flex items-center gap-1 text-xs tracking-wide transition-colors",
                        hasActive
                          ? "text-white"
                          : "text-white/50 group-hover:text-white/80"
                      )}
                    >
                      {item.label}
                      <ChevronDown
                        className={classnames(
                          "w-3 h-3 transition-transform duration-150",
                          isOpen && "rotate-180"
                        )}
                      />
                    </button>

                    {/* Dropdown panel */}
                    <div
                      className={classnames(
                        "absolute top-full left-1/2 -translate-x-1/2 pt-0 transition-all duration-150 origin-top",
                        "opacity-0 invisible translate-y-1 group-hover:opacity-100 group-hover:visible group-hover:translate-y-0",
                        isOpen && "opacity-100 visible translate-y-0"
                      )}
                    >
                      <ul className="bg-black border border-white/10 min-w-[160px] py-1">
                        {item.items.map((sub) => {
                          const subActive = isActive(sub.path, currentPath);
                          return (
                            <li key={sub.path}>
                              <Link
                                to={sub.path}
                                onClick={closeAll}
                                className={classnames(
                                  "block px-4 py-1.5 text-xs transition-colors",
                                  subActive
                                    ? "text-white"
                                    : "text-white/50 hover:text-white/80"
                                )}
                              >
                                {sub.name}
                              </Link>
                            </li>
                          );
                        })}
                      </ul>
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>

          {/* Hamburger */}
          <button
            onClick={() => setMobileOpen((prev) => !prev)}
            className="lg:hidden flex items-center justify-center w-8 h-8 text-white/70 hover:text-white transition-colors"
            aria-label="Toggle menu"
            aria-expanded={mobileOpen}
          >
            {mobileOpen ? <X className="w-4 h-4" /> : <Menu className="w-4 h-4" />}
          </button>
        </div>

        {/* Mobile menu */}
        <div
          className={classnames(
            "lg:hidden overflow-hidden transition-all duration-250 ease-in-out",
            mobileOpen ? "max-h-[360px] opacity-100" : "max-h-0 opacity-0"
          )}
        >
          <ul className="pb-3 pt-2 space-y-0.5 border-t border-white/10">
            {navigationGroups.map((item) => {
              if ("path" in item) {
                const active = isActive(item.path, currentPath);
                return (
                  <li key={item.path}>
                    <Link
                      to={item.path}
                      onClick={closeAll}
                      className={classnames(
                        "block px-3 py-2 text-xs transition-colors rounded",
                        active
                          ? "text-white"
                          : "text-white/60 hover:text-white/90 "
                      )}
                    >
                      {item.name}
                    </Link>
                  </li>
                );
              }

              const isOpen = openDropdowns.has(item.label);
              const hasActive = item.items.some((sub) => isActive(sub.path, currentPath));

              return (
                <li key={item.label}>
                  <button
                    onClick={() => toggleDropdown(item.label)}
                    className={classnames(
                      "w-full flex items-center justify-between px-3 py-2 text-xs transition-colors rounded",
                      hasActive
                        ? "text-white"
                        : "text-white/60 hover:text-white/90"
                    )}
                  >
                    {item.label}
                    <ChevronDown
                      className={classnames(
                        "w-3 h-3 transition-transform duration-150",
                        isOpen && "rotate-180"
                      )}
                    />
                  </button>
                  <div
                    className={classnames(
                      "overflow-hidden transition-all duration-250 ease-in-out",
                      isOpen ? "max-h-40 opacity-100" : "max-h-0 opacity-0"
                    )}
                  >
                    <ul className="pl-3 pr-2 pb-1 space-y-0.5">
                      {item.items.map((sub) => {
                        const subActive = isActive(sub.path, currentPath);
                        return (
                          <li key={sub.path}>
                            <Link
                              to={sub.path}
                              onClick={closeAll}
                              className={classnames(
                                "block px-3 py-1.5 text-xs transition-colors rounded",
                                subActive
                                  ? "text-white"
                                  : "text-white/50 hover:text-white/80"
                              )}
                            >
                              {sub.name}
                            </Link>
                          </li>
                        );
                      })}
                    </ul>
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
      </div>
    </nav>
  );
}
