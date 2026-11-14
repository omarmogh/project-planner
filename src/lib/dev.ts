// Dev-only switches, invisible to classmates:
//   ?dir=rtl          right-to-left layout (Arabic check), no translation
//   Ctrl+Shift+D      toggle ltr/rtl
//   ?reset            start a fresh demo (also: long-press the wordmark)

export function initDev(reset: () => void) {
  const params = new URLSearchParams(location.search)
  if (params.get('dir') === 'rtl') document.documentElement.dir = 'rtl'
  if (params.has('reset')) {
    reset()
    params.delete('reset')
    const q = params.toString()
    history.replaceState(null, '', location.pathname + (q ? `?${q}` : ''))
  }
  const onKey = (e: KeyboardEvent) => {
    if (e.ctrlKey && e.shiftKey && e.key.toLowerCase() === 'd') {
      e.preventDefault()
      const html = document.documentElement
      html.dir = html.dir === 'rtl' ? 'ltr' : 'rtl'
    }
  }
  window.addEventListener('keydown', onKey)
  return () => window.removeEventListener('keydown', onKey)
}
