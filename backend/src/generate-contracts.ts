import { readdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

import { format, resolveConfig } from 'prettier';
import { generateApi } from 'swagger-typescript-api';
import { parse as parseYaml } from 'yaml';

import { API_BASE_URL, APIS } from './config/index';

const PATH_TO_OUTPUT_DIR = path.resolve(process.cwd(), './src/data-contracts');

type SpecFormat = 'json' | 'yaml';

export type ContractGenerator = (options: Parameters<typeof generateApi>[0]) => Promise<unknown>;

export interface ContractGenerationDependencies {
  fetcher?: typeof fetch;
  generate?: ContractGenerator;
}

const isSpecObject = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value);

/**
 * Returns undefined for generic types like text/plain and application/octet-stream: they say
 * nothing about the format, so the body is sniffed instead.
 */
const detectSpecFormat = (contentType: string | null): SpecFormat | undefined => {
  const mediaType = contentType?.split(';')[0]?.trim().toLowerCase();
  if (!mediaType) {
    return undefined;
  }
  if (mediaType === 'application/json' || mediaType.endsWith('+json')) {
    return 'json';
  }
  if (/ya?ml$/.test(mediaType)) {
    return 'yaml';
  }
  return undefined;
};

const parseSpec = (body: string, format: SpecFormat): Record<string, unknown> | undefined => {
  try {
    const parsed: unknown = format === 'json' ? JSON.parse(body) : parseYaml(body);
    return isSpecObject(parsed) ? parsed : undefined;
  } catch {
    return undefined;
  }
};

export const fetchOpenApiDocument = async (url: string, fetcher: typeof fetch = fetch, apiName?: string): Promise<Record<string, unknown>> => {
  const response = await fetcher(url);
  if (!response.ok) {
    throw new Error(`Kunde inte hämta api-docs från ${url} (HTTP ${response.status})`);
  }

  const contentType = response.headers.get('content-type');
  const body = await response.text();

  // JSON is a subset of YAML, so both parsers are tried regardless of header; the header only
  // decides the order.
  const declaredFormat = detectSpecFormat(contentType);
  const attempts: SpecFormat[] = declaredFormat === 'yaml' ? ['yaml', 'json'] : ['json', 'yaml'];

  for (const format of attempts) {
    const document = parseSpec(body, format);
    if (document) {
      return document;
    }
  }

  const target = apiName ? `${apiName} (${url})` : url;
  throw new Error(`Kunde inte tolka api-docs för ${target} som JSON eller YAML (content-type: ${contentType ?? 'saknas'})`);
};

/**
 * swagger-typescript-api stopped formatting its output in v13, so generated files came out with
 * double quotes and failed `yarn format:check` in CI. Format them here against the project's own
 * prettier config instead.
 */
export const formatGeneratedFiles = async (outputDir: string): Promise<void> => {
  const entries = await readdir(outputDir, { withFileTypes: true });

  for (const entry of entries) {
    if (!entry.isFile() || !entry.name.endsWith('.ts')) {
      continue;
    }

    const filePath = path.join(outputDir, entry.name);
    const source = await readFile(filePath, 'utf-8');
    const options = await resolveConfig(filePath);
    await writeFile(filePath, await format(source, { ...options, filepath: filePath }), 'utf-8');
  }
};

export const main = async ({ fetcher = fetch, generate = generateApi }: ContractGenerationDependencies = {}): Promise<void> => {
  if (!API_BASE_URL) {
    throw new Error('API_BASE_URL måste vara satt för att generera kontrakt');
  }

  for (const api of APIS) {
    const outputDir = path.join(PATH_TO_OUTPUT_DIR, api.name);
    const apiDocsUrl = `${API_BASE_URL.replace(/\/$/, '')}/${api.name}/${api.version}/api-docs`;
    const spec = await fetchOpenApiDocument(apiDocsUrl, fetcher, api.name);

    await generate({
      spec,
      output: outputDir,
      modular: true,
      generateClient: false,
      cleanOutput: true,
      extractEnums: true,
    });

    await formatGeneratedFiles(outputDir);
  }
};

if (require.main === module) {
  void main().catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  });
}
