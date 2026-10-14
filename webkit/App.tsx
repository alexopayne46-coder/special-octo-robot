import { lazy, Suspense, useEffect, useState } from "react";
import type { ComponentType, LazyExoticComponent } from "react";
import { Routes, Route, useLocation, matchPath } from "react-router-dom";
import Navbar from "./components/Navbar";
import Breadcrumbs from "./components/Breadcrumbs";
import { BreadcrumbsItem } from "./stores/app";

// Lazy-loaded pages (each page file must have a default export)
const Main = lazy(() => import("./pages/Main"));
const Chats = lazy(() => import("./pages/Chats"));
const Audience = lazy(() => import("./pages/Audience"));
const LookALikeUsers = lazy(() => import("./pages/LookALikeUsers"));
const Import = lazy(() => import("./pages/Import"));
const AdCampaignMaster = lazy(() => import("./pages/AdCampaignMaster"));
const CampaignArtifacts = lazy(() => import("./pages/CampaignArtifacts"));
const Proxies = lazy(() => import("./pages/Proxies"));
const Accounts = lazy(() => import("./pages/Accounts"));

type RouteConfig = {
  component: LazyExoticComponent<ComponentType<any>>;
  breadcrumbs: BreadcrumbsItem[];
};

// Defined outside the component so it's created once and never re-created on render
const routerMapper: Record<string, RouteConfig> = {
  "/": {
    component: Main,
    breadcrumbs: [{ label: "Home", href: "/" }],
  },
  "/application/main": {
    component: Main,
    breadcrumbs: [{ label: "Accounts", href: "/application/main" }],
  },
  "/application/audience/chats": {
    component: Chats,
    breadcrumbs: [
      { label: "Audience", href: "/application/audience" },
      { label: "Chats", href: "/application/audience/chats" },
    ],
  },
  "/application/audience": {
    component: Audience,
    breadcrumbs: [{ label: "Audience", href: "/application/audience" }],
  },
  "/application/audience/lookalike-users": {
    component: LookALikeUsers,
    breadcrumbs: [
      { label: "Audience", href: "/application/audience" },
      { label: "Lookalike Users", href: "/application/audience/lookalike-users" },
    ],
  },
  "/application/import": {
    component: Import,
    breadcrumbs: [{ label: "Import", href: "/application/import" }],
  },
  "/application/campaigns": {
    component: AdCampaignMaster,
    breadcrumbs: [{ label: "Campaigns", href: "/application/campaigns" }],
  },
  "/application/campaigns/artifacts": {
    component: CampaignArtifacts,
    breadcrumbs: [
      { label: "Campaigns", href: "/application/campaigns" },
      { label: "Artifacts", href: "/application/campaigns/artifacts" },
    ],
  },
  "/application/campaigns/:campaignId/artifacts": {
    component: CampaignArtifacts,
    breadcrumbs: [{ label: "Campaigns", href: "/application/campaigns" }],
  },
  "/application/proxies": {
    component: Proxies,
    breadcrumbs: [{ label: "Proxies", href: "/application/proxies" }],
  },
  "/application/accounts": {
    component: Accounts,
    breadcrumbs: [{ label: "Accounts", href: "/application/accounts" }],
  },
};

const App = () => {
  const location = useLocation();
  const [currentBreadcrumbs, setCurrentBreadcrumbs] = useState<BreadcrumbsItem[]>([]);

  useEffect(() => {
    const matchedKey = Object.keys(routerMapper).find((path) =>
      matchPath({ path, end: true }, location.pathname)
    );

    if (!matchedKey) {
      setCurrentBreadcrumbs([]);
      return;
    }

    const campaignMatch = matchPath(
      { path: "/application/campaigns/:campaignId/artifacts", end: true },
      location.pathname
    );

    if (campaignMatch) {
      const id = campaignMatch.params.campaignId;
      setCurrentBreadcrumbs([
        { label: "Campaigns", href: "/application/campaigns" },
        { label: `#${id}`, href: `/application/campaigns/${id}/artifacts` },
        { label: "Artifacts", href: `/application/campaigns/${id}/artifacts` },
      ]);
      return;
    }

    setCurrentBreadcrumbs(routerMapper[matchedKey].breadcrumbs);
  }, [location.pathname]);

  return (
    <div className="space-y-4">
      <Navbar />

      <div className="container mx-auto">
        <Breadcrumbs breadcrumbs={currentBreadcrumbs} />
      </div>

      <main className="container mx-auto">
        <Suspense fallback={<div className="flex items-center justify-center h-96">
          <span className="loading loading-infinity loading-xs"></span>
        </div>}>
          <Routes>
            {Object.entries(routerMapper).map(([path, { component: Page }]) => (
              <Route key={path} path={path} element={<Page />} />
            ))}
          </Routes>
        </Suspense>
      </main>
    </div>
  );
};

export default App;