import { create } from 'zustand'

export interface BreadcrumbsItem {
  label: string
  href: string
}

interface AppStore {
  breadcrumbs: BreadcrumbsItem[]
  setBreadcrumbs: (breadcrumbs: BreadcrumbsItem[]) => void
}

export const useAppStore = create<AppStore>((set) => ({
  breadcrumbs: [],
  setBreadcrumbs: (breadcrumbs: BreadcrumbsItem[]) => set({ breadcrumbs }),
}))