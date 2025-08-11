import { Helmet } from "react-helmet-async";

export function SEO({
  title,
  description,
  canonical,
}: {
  title: string;
  description?: string;
  canonical?: string;
}) {
  const metaTitle = title.length > 60 ? title.slice(0, 57) + "..." : title;
  const metaDescription = description
    ? description.slice(0, 157)
    : "Gestión y análisis de licitaciones con comparativos claros y validaciones rápidas.";

  return (
    <Helmet>
      <title>{metaTitle}</title>
      {metaDescription && <meta name="description" content={metaDescription} />}
      {canonical && <link rel="canonical" href={canonical} />}
      <meta property="og:title" content={metaTitle} />
      {metaDescription && (
        <meta property="og:description" content={metaDescription} />
      )}
      <meta property="og:type" content="website" />
    </Helmet>
  );
}
