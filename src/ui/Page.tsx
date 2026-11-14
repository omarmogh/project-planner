import type { ReactNode } from 'react'
import { Nav } from './Nav'

/**
 * The one layout component. Screens describe content; Page decides the layout:
 * - Phone (< 40rem): single column, sticky primary action, bottom tabs.
 * - Tablet (40–64rem): the same, with more room; column max 40rem, centred.
 * - Desktop (≥ 64rem): sidebar instead of bottom tabs; column max 45rem;
 *   the primary action is a normal button in the content, not sticky.
 *
 * `footer` = the primary action. `below` = content that goes after the
 * primary action on desktop (e.g. Tomorrow), and above it on phone/tablet.
 * `centered` = centred content (the timer); the desktop action centres with it.
 */
export function Page({
  children, footer, top, below, withTabs = false, centered = false,
}: { children: ReactNode; footer?: ReactNode; top?: ReactNode; below?: ReactNode; withTabs?: boolean; centered?: boolean }) {
  return (
    <div className={withTabs ? 'pb-tabbar desktop:ps-sidebar desktop:pb-0' : ''}>
      {withTabs && <Nav variant="side" />}
      <div className="mx-auto flex min-h-dvh w-full max-w-phone flex-col tablet:max-w-tablet desktop:max-w-desktop desktop:min-h-0 desktop:pt-6 desktop:pb-16">
        {top}
        <main className="px-5 pb-6 tablet:px-8 desktop:flex-none flex-1">{children}</main>
        {footer && (
          <div
            className={`sticky z-10 order-last bg-bg px-5 pt-3 tablet:px-8 desktop:static desktop:order-none desktop:w-full desktop:max-w-action desktop:pt-2 desktop:pb-0 ${centered ? 'desktop:mx-auto' : ''} ${
              withTabs ? 'bottom-tabbar pb-3' : 'bottom-0 pb-safe-4'
            }`}
          >
            {footer}
          </div>
        )}
        {below && <div className="px-5 pb-6 tablet:px-8 desktop:pt-4">{below}</div>}
      </div>
      {withTabs && <Nav variant="bottom" />}
    </div>
  )
}
