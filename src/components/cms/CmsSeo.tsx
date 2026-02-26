import { Helmet } from 'react-helmet-async'

interface CmsSeoProps {
  title: string
  description?: string | null
  keywords?: string | null
  canonicalUrl?: string | null
  robots?: string
  ogTitle?: string | null
  ogDescription?: string | null
  ogImage?: string | null
  twitterTitle?: string | null
  twitterDescription?: string | null
  jsonLd?: Record<string, unknown> | null
}

export function CmsSeo({
  title,
  description,
  keywords,
  canonicalUrl,
  robots = 'index,follow',
  ogTitle,
  ogDescription,
  ogImage,
  twitterTitle,
  twitterDescription,
  jsonLd,
}: CmsSeoProps) {
  return (
    <Helmet>
      <title>{title}</title>
      {description ? <meta name="description" content={description} /> : null}
      {keywords ? <meta name="keywords" content={keywords} /> : null}
      <meta name="robots" content={robots} />
      {canonicalUrl ? <link rel="canonical" href={canonicalUrl} /> : null}

      <meta property="og:type" content="website" />
      <meta property="og:title" content={ogTitle || title} />
      {ogDescription || description ? (
        <meta property="og:description" content={ogDescription || description || ''} />
      ) : null}
      {ogImage ? <meta property="og:image" content={ogImage} /> : null}
      {canonicalUrl ? <meta property="og:url" content={canonicalUrl} /> : null}

      <meta name="twitter:card" content="summary_large_image" />
      <meta name="twitter:title" content={twitterTitle || title} />
      {twitterDescription || description ? (
        <meta name="twitter:description" content={twitterDescription || description || ''} />
      ) : null}
      {ogImage ? <meta name="twitter:image" content={ogImage} /> : null}

      {jsonLd ? (
        <script type="application/ld+json">
          {JSON.stringify(jsonLd)}
        </script>
      ) : null}
    </Helmet>
  )
}
