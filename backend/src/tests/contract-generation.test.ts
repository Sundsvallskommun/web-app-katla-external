import { describe, expect, it, vi } from 'vitest';

import type { ContractGenerator } from '@/generate-contracts';
import { fetchOpenApiDocument, main } from '@/generate-contracts';

const yamlSpec = ['openapi: 3.0.0', 'info:', '  title: Ärenden', '  version: "1.0"', 'paths: {}'].join('\n');
const parsedYamlSpec = { openapi: '3.0.0', info: { title: 'Ärenden', version: '1.0' }, paths: {} };

const respondWith = (body: string, contentType?: string): Response => {
  const response = new Response(body, { status: 200 });
  if (contentType) {
    response.headers.set('content-type', contentType);
  } else {
    response.headers.delete('content-type');
  }
  return response;
};

describe('contract generation', () => {
  it('returns a parsed OpenAPI document for a successful response', async () => {
    const document = { openapi: '3.0.0' };
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(JSON.stringify(document), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      }),
    );

    await expect(fetchOpenApiDocument('https://api.example.com/api-docs', fetcher)).resolves.toEqual(document);
  });

  it('parses a YAML document announced as application/yaml', async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(respondWith(yamlSpec, 'application/yaml'));

    await expect(fetchOpenApiDocument('https://api.example.com/api-docs', fetcher)).resolves.toEqual(parsedYamlSpec);
  });

  it.each(['text/x-yaml', 'application/x-yaml', 'application/vnd.oai.openapi+yaml;charset=utf-8'])(
    'parses a YAML document announced as %s',
    async contentType => {
      const fetcher = vi.fn<typeof fetch>().mockResolvedValue(respondWith(yamlSpec, contentType));

      await expect(fetchOpenApiDocument('https://api.example.com/api-docs', fetcher)).resolves.toEqual(parsedYamlSpec);
    },
  );

  it('parses a YAML document served with a generic content-type', async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(respondWith(yamlSpec, 'text/plain;charset=utf-8'));

    await expect(fetchOpenApiDocument('https://api.example.com/api-docs', fetcher)).resolves.toEqual(parsedYamlSpec);
  });

  it('parses a YAML document served without a content-type', async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(respondWith(yamlSpec));

    await expect(fetchOpenApiDocument('https://api.example.com/api-docs', fetcher)).resolves.toEqual(parsedYamlSpec);
  });

  it('parses a JSON document announced as YAML, since JSON is a subset of YAML', async () => {
    const document = { openapi: '3.0.0', paths: {} };
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(respondWith(JSON.stringify(document), 'text/yaml'));

    await expect(fetchOpenApiDocument('https://api.example.com/api-docs', fetcher)).resolves.toEqual(document);
  });

  it('parses a JSON document served without a content-type', async () => {
    const document = { openapi: '3.0.0', paths: {} };
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(respondWith(JSON.stringify(document)));

    await expect(fetchOpenApiDocument('https://api.example.com/api-docs', fetcher)).resolves.toEqual(document);
  });

  it('fails with the API name and URL when the body is neither JSON nor YAML', async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(respondWith('<html><body>Gateway Timeout</body></html>', 'text/html'));

    await expect(fetchOpenApiDocument('https://api.example.com/api-docs', fetcher, 'errands')).rejects.toThrow(
      'Kunde inte tolka api-docs för errands (https://api.example.com/api-docs) som JSON eller YAML (content-type: text/html)',
    );
  });

  it('fails when a YAML body is syntactically broken', async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(respondWith('openapi: 3.0.0\npaths: [unclosed\n', 'application/yaml'));

    await expect(fetchOpenApiDocument('https://api.example.com/api-docs', fetcher)).rejects.toThrow('som JSON eller YAML');
  });

  it('fails when the API documentation cannot be fetched', async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(new Response('', { status: 404 }));

    await expect(fetchOpenApiDocument('https://api.example.com/api-docs', fetcher)).rejects.toThrow(
      'Kunde inte hämta api-docs från https://api.example.com/api-docs (HTTP 404)',
    );
  });

  it('does not generate files after a failed download', async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(new Response('', { status: 404 }));
    const generate = vi.fn<ContractGenerator>();

    await expect(main({ fetcher, generate })).rejects.toThrow('(HTTP 404)');
    expect(generate).not.toHaveBeenCalled();
  });

  it('feeds a YAML spec to the generator', async () => {
    // main() iterates over every API, so each call needs its own Response with an unread body.
    const fetcher = vi.fn<typeof fetch>().mockImplementation(() => Promise.resolve(respondWith(yamlSpec, 'application/yaml')));
    const generate = vi.fn<ContractGenerator>().mockResolvedValue(undefined);

    await main({ fetcher, generate });

    expect(generate).toHaveBeenCalled();
    expect(generate.mock.calls[0]?.[0]).toMatchObject({ spec: parsedYamlSpec });
  });
});
