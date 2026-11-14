import type { ReactNode } from 'react'

/** Single column, phone-first. `footer` sticks to the bottom (primary action). */
export function Page({ children, footer, top, withTabs = false }: { children: ReactNode; footer?: ReactNode; top?: ReactNode; withTabs?: boolean }) {
  return (
    <div className={`mx-auto flex min-h-dvh w-full max-w-[560px] flex-col ${withTabs ? 'pb-[calc(56px+env(safe-area-inset-bottom))]' : ''}`}>
      {top}
      <main className="flex-1 px-5 pb-6 sm:px-8">{children}</main>
      {footer && (
        <div className={`sticky z-10 bg-bg px-5 pt-3 sm:px-8 ${withTabs ? 'bottom-[calc(56px+env(safe-area-inset-bottom))] pb-3' : 'bottom-0 pb-[max(16px,env(safe-area-inset-bottom))]'}`}>
          {footer}
        </div>
      )}
    </div>
  )
}
