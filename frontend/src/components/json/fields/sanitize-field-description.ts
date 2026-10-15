import SanitizeHTML from 'sanitize-html';

const FIELD_DESCRIPTION_TAGS = [
  'h1',
  'h2',
  'h3',
  'h4',
  'h5',
  'blockquote',
  'p',
  'a',
  'ul',
  'ol',
  'li',
  'b',
  'i',
  'strong',
  'em',
  'strike',
  'del',
  'br',
  'div',
  'sup',
  'sub',
] as const;

export interface SanitizedFieldDescription {
  html: string;
  hasNewTabLink: boolean;
}

/** Sanitises schema-owned text without depending on browser globals. */
export function sanitizeFieldDescription(unsafeHtml: string, newTabAnnouncementId: string): SanitizedFieldDescription {
  let hasNewTabLink = false;
  // One pass is enough: the transform rebuilds the link attributes from scratch and copies only
  // href, so an incoming rel or aria-describedby can never survive.
  // allowedSchemes filters the schemes after the transform.
  const options: SanitizeHTML.IOptions = {
    allowedTags: [...FIELD_DESCRIPTION_TAGS],
    allowedAttributes: {
      a: ['href', 'target', 'rel', 'aria-describedby'],
    },
    allowedSchemes: ['http', 'https', 'mailto'],
    allowProtocolRelative: false,
    transformTags: {
      a: (tagName, attributes) => {
        const safeAttributes: Record<string, string> = {};
        if (attributes.href) safeAttributes.href = attributes.href;

        // Only the canonical HTML keyword opens a new tab. Named targets and differently cased
        // variants are dropped rather than trusted.
        if (attributes.target !== '_blank' || !attributes.href) return { tagName, attribs: safeAttributes };

        hasNewTabLink = true;
        return {
          tagName,
          attribs: {
            ...safeAttributes,
            target: '_blank',
            rel: 'noopener noreferrer',
            'aria-describedby': newTabAnnouncementId,
          },
        };
      },
    },
  };

  return {
    html: SanitizeHTML(unsafeHtml, options),
    hasNewTabLink,
  };
}
