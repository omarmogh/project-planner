import type { ButtonHTMLAttributes } from 'react'

type Variant = 'primary' | 'secondary' | 'plain'

const styles: Record<Variant, string> = {
  primary: 'bg-accent text-on-accent font-semibold active:opacity-80 disabled:opacity-35',
  secondary: 'bg-surface text-fg font-medium active:opacity-70 disabled:opacity-40',
  plain: 'text-accent font-medium active:opacity-60 disabled:opacity-40',
}

export function Button({ variant = 'primary', className = '', ...rest }: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant }) {
  return (
    <button
      type="button"
      className={`flex min-h-13 w-full items-center justify-center gap-2 rounded-lg px-5 py-3 text-body transition-opacity ${styles[variant]} ${className}`}
      {...rest}
    />
  )
}
