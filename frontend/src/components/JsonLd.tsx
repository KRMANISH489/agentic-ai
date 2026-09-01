import { FAQ, FEATURES, SITE_AUTHOR, SITE_NAME, SITE_URL, DEFAULT_DESCRIPTION, DEFAULT_TITLE } from "@/lib/seo";

export function JsonLd() {
  const graph = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "WebApplication",
        "@id": `${SITE_URL}/#app`,
        name: SITE_NAME,
        url: SITE_URL,
        description: DEFAULT_DESCRIPTION,
        applicationCategory: "EducationalApplication",
        operatingSystem: "Web",
        inLanguage: ["en", "hi"],
        offers: {
          "@type": "Offer",
          price: "0",
          priceCurrency: "USD",
        },
        author: { "@id": `${SITE_URL}/#author` },
        featureList: FEATURES.map((item) => item.title),
      },
      {
        "@type": "WebSite",
        "@id": `${SITE_URL}/#website`,
        name: SITE_NAME,
        url: SITE_URL,
        description: DEFAULT_DESCRIPTION,
        inLanguage: "en",
        publisher: { "@id": `${SITE_URL}/#author` },
      },
      {
        "@type": "Person",
        "@id": `${SITE_URL}/#author`,
        name: SITE_AUTHOR,
        url: SITE_URL,
        jobTitle: "Developer",
      },
      {
        "@type": "FAQPage",
        "@id": `${SITE_URL}/#faq`,
        mainEntity: FAQ.map((item) => ({
          "@type": "Question",
          name: item.q,
          acceptedAnswer: {
            "@type": "Answer",
            text: item.a,
          },
        })),
      },
      {
        "@type": "BreadcrumbList",
        itemListElement: [
          {
            "@type": "ListItem",
            position: 1,
            name: "Home",
            item: SITE_URL,
          },
          {
            "@type": "ListItem",
            position: 2,
            name: "About",
            item: `${SITE_URL}/about`,
          },
        ],
      },
    ],
  };

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(graph) }}
    />
  );
}

export function AboutJsonLd() {
  const data = {
    "@context": "https://schema.org",
    "@type": "AboutPage",
    name: `About ${SITE_NAME}`,
    url: `${SITE_URL}/about`,
    description: DEFAULT_TITLE,
    mainEntity: {
      "@id": `${SITE_URL}/#app`,
    },
  };

  return (
    <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }} />
  );
}
