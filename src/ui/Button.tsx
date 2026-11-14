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
      className={`flex h-[52px] w-full items-center justify-center gap-2 rounded-2xl px-5 text-[17px] transition-opacity ${styles[variant]} ${className}`}
      {...rest}
    />
  )
}
