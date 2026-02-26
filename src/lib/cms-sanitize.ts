import DOMPurify from 'dompurify'

const ALLOWED_TAGS = [
  'p', 'br', 'strong', 'em', 'u', 's', 'blockquote', 'code', 'pre',
  'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
  'ul', 'ol', 'li',
  'a', 'img',
  'table', 'thead', 'tbody', 'tr', 'th', 'td',
  'hr', 'span', 'div', 'iframe'
]

const ALLOWED_ATTR = [
  'href', 'src', 'alt', 'title', 'target', 'rel',
  'class', 'id', 'width', 'height', 'loading',
  'frameborder', 'allow', 'allowfullscreen', 'referrerpolicy'
]

const ALLOWED_URI = /^(?:(?:https?|mailto|tel):|\/|#)/i
const ALLOWED_IFRAME_HOSTS = new Set([
  'www.youtube.com',
  'youtube.com',
  'www.youtube-nocookie.com',
  'youtube-nocookie.com'
])

export function sanitizeCmsHtml(input: string): string {
  const origin = typeof window !== 'undefined' ? window.location.origin : 'https://example.com'
  const sanitized = DOMPurify.sanitize(input, {
    ALLOWED_TAGS,
    ALLOWED_ATTR,
    ALLOWED_URI_REGEXP: ALLOWED_URI,
    FORBID_TAGS: ['script', 'style', 'object', 'embed', 'form'],
    FORBID_ATTR: ['onerror', 'onload', 'onclick', 'onmouseover'],
    ADD_ATTR: ['rel'],
    RETURN_TRUSTED_TYPE: false
  })

  const doc = new DOMParser().parseFromString(`<div id="cms-root">${sanitized}</div>`, 'text/html')
  const root = doc.getElementById('cms-root')
  if (!root) return sanitized

  const iframes = root.querySelectorAll('iframe')
  for (const iframe of iframes) {
    const src = iframe.getAttribute('src')
    if (!src) {
      iframe.remove()
      continue
    }

    try {
      const url = new URL(src, origin)
      if (!ALLOWED_IFRAME_HOSTS.has(url.hostname)) {
        iframe.remove()
        continue
      }
      iframe.setAttribute('loading', 'lazy')
      iframe.setAttribute('referrerpolicy', 'no-referrer')
      iframe.setAttribute('sandbox', 'allow-scripts allow-same-origin allow-presentation')
    } catch {
      iframe.remove()
    }
  }

  return root.innerHTML
}
