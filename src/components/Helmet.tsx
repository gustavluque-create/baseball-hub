import React, { useEffect } from 'react';

export interface HelmetProps {
  title?: string;
  description?: string;
  keywords?: string;
  canonicalUrl?: string;
  ogType?: 'website' | 'article' | 'profile' | 'sports_event';
  ogImage?: string;
  jsonLd?: Record<string, any> | Record<string, any>[];
  children?: React.ReactNode;
}

function updateMetaTag(nameOrProperty: string, value: string, isProperty = false) {
  if (typeof document === 'undefined') return;
  const selector = isProperty
    ? `meta[property="${nameOrProperty}"]`
    : `meta[name="${nameOrProperty}"]`;

  let element = document.querySelector(selector) as HTMLMetaElement | null;
  if (!element) {
    element = document.createElement('meta');
    if (isProperty) {
      element.setAttribute('property', nameOrProperty);
    } else {
      element.setAttribute('name', nameOrProperty);
    }
    document.head.appendChild(element);
  }
  element.setAttribute('content', value);
}

function updateCanonicalLink(url: string) {
  if (typeof document === 'undefined') return;
  let link = document.querySelector('link[rel="canonical"]') as HTMLLinkElement | null;
  if (!link) {
    link = document.createElement('link');
    link.setAttribute('rel', 'canonical');
    document.head.appendChild(link);
  }
  link.setAttribute('href', url);
}

function updateJsonLd(data: Record<string, any> | Record<string, any>[]) {
  if (typeof document === 'undefined') return;
  let script = document.getElementById('dynamic-jsonld') as HTMLScriptElement | null;
  if (!script) {
    script = document.createElement('script');
    script.id = 'dynamic-jsonld';
    script.type = 'application/ld+json';
    document.head.appendChild(script);
  }
  script.textContent = JSON.stringify(data);
}

export const Helmet: React.FC<HelmetProps> = ({
  title,
  description,
  keywords,
  canonicalUrl,
  ogType = 'website',
  ogImage = 'https://images.unsplash.com/photo-1508344928928-7165b67de128?w=1200&auto=format&fit=crop&q=80',
  jsonLd,
  children,
}) => {
  // Extract data from props or children
  let finalTitle = title;
  let finalDescription = description;

  if (children) {
    React.Children.forEach(children, (child) => {
      if (React.isValidElement(child)) {
        const element = child as React.ReactElement<{
          name?: string;
          property?: string;
          content?: string;
          children?: React.ReactNode;
        }>;
        if (element.type === 'title' && typeof element.props.children === 'string') {
          finalTitle = element.props.children;
        } else if (element.type === 'meta') {
          const name = element.props.name;
          const property = element.props.property;
          const content = element.props.content;
          if (name === 'description' && content) finalDescription = content;
          if (property === 'og:title' && content) finalTitle = content;
        }
      }
    });
  }

  useEffect(() => {
    if (typeof window === 'undefined') return;

    // 1. Title
    if (finalTitle) {
      document.title = finalTitle;
      updateMetaTag('og:title', finalTitle, true);
      updateMetaTag('twitter:title', finalTitle, false);
    }

    // 2. Meta description
    if (finalDescription) {
      updateMetaTag('description', finalDescription, false);
      updateMetaTag('og:description', finalDescription, true);
      updateMetaTag('twitter:description', finalDescription, false);
    }

    // 3. Keywords
    if (keywords) {
      updateMetaTag('keywords', keywords, false);
    }

    // 4. OpenGraph & Twitter Core
    updateMetaTag('og:type', ogType, true);
    updateMetaTag('og:site_name', 'Baseball Hub', true);
    updateMetaTag('twitter:card', 'summary_large_image', false);

    // 5. Canonical URL & og:url
    const currentOrigin = window.location.origin;
    const currentPath = window.location.pathname;
    const resolvedUrl = canonicalUrl || `${currentOrigin}${currentPath}`;
    updateCanonicalLink(resolvedUrl);
    updateMetaTag('og:url', resolvedUrl, true);

    // 6. Image
    if (ogImage) {
      updateMetaTag('og:image', ogImage, true);
      updateMetaTag('twitter:image', ogImage, false);
    }

    // 7. Structured Data (JSON-LD)
    if (jsonLd) {
      updateJsonLd(jsonLd);
    }
  }, [finalTitle, finalDescription, keywords, canonicalUrl, ogType, ogImage, jsonLd]);

  return null;
};
