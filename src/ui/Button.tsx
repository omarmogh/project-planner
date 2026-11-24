import type { ButtonHTMLAttributes } from 'react'

type Variant = 'primary' | 'secondary' | 'plain'

const styles: Record<Variant, string> = {
  primary: 'bg-accent text-on-accent font-semibold hover:opacity-90 active:opacity-80 disabled:bg-disabled disabled:text-on-disabled disabled:cursor-not-allowed',
  secondary: 'bg-surface text-fg font-medium hover:bg-line active:opacity-70 disabled:opacity-40',
  plain: 'text-accent font-medium hover:bg-accent-soft active:opacity-60 disabled:opacity-40',
}

export function Button({ variant = 'primary', className = '', ...rest }: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant }) {
  return (
    <button
      type="button"
      className={`flex min-h-13 w-full items-center justify-center gap-2 press rounded-lg px-5 py-3 text-body ${styles[variant]} ${className}`}
      {...rest}
    />
  )
}
