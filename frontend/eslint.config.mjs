import nextCoreWebVitals from 'eslint-config-next/core-web-vitals';
import eslintConfigPrettier from 'eslint-config-prettier';
import reactRefresh from 'eslint-plugin-react-refresh';
import simpleImportSort from 'eslint-plugin-simple-import-sort';
import unusedImports from 'eslint-plugin-unused-imports';
import tseslint from 'typescript-eslint';

// OBS om typescript-eslint-pluginen: eslint-config-next resolvar `typescript-eslint`
// från den hoistade toppnivåinstallationen, så att sprida tseslint.configs.strictTypeChecked
// här återanvänder SAMMA plugin-instans som Next registrerar — ingen
// "Cannot redefine plugin @typescript-eslint"-krock. Håll `typescript-eslint`-beroendet
// i nivå med eslint-config-nexts version så de dedupas.
export default tseslint.config(
  {
    linterOptions: { noInlineConfig: true, reportUnusedDisableDirectives: 'error' },
  },
  {
    ignores: [
      '.next/**',
      'out/**',
      'coverage/**',
      'playwright-report/**',
      'test-results/**',
      'next-env.d.ts',
      'src/data-contracts/**',
      '*.config.js',
      '*.config.mjs',
      '*.config.mts',
      '*.config.ts',
      'middleware-envs-generator.mjs',
      'middleware-envs.js',
    ],
  },
  // Next.js (React + react-hooks + @next/next + core-web-vitals + @typescript-eslint-bas).
  ...nextCoreWebVitals,
  // Maximal, typmedveten strikthet — samma uppsättning som web-app-starter.
  ...tseslint.configs.strictTypeChecked,
  ...tseslint.configs.stylisticTypeChecked,
  {
    files: ['**/*.{ts,tsx}'],
    languageOptions: {
      parserOptions: {
        // Dedikerad tsconfig som även täcker tests/ och e2e/ så typmedvetna regler har typinfo.
        project: ['./tsconfig.eslint.json'],
        tsconfigRootDir: import.meta.dirname,
      },
    },
    plugins: {
      'react-refresh': reactRefresh,
      'simple-import-sort': simpleImportSort,
      'unused-imports': unusedImports,
    },
    rules: {
      'react-refresh/only-export-components': [
        'error',
        { allowExportNames: ['generateMetadata', 'generateStaticParams'] },
      ],
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/no-unused-vars': 'off',
      'unused-imports/no-unused-imports': 'error',
      'unused-imports/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_', caughtErrorsIgnorePattern: '^_' },
      ],
      'simple-import-sort/imports': 'error',
      'simple-import-sort/exports': 'error',
      // console.log är förbjudet, warn/error tillåtna.
      'no-console': ['error', { allow: ['warn', 'error'] }],
      // Primitiver i template-literals är ok; objekt/`unknown` flaggas fortfarande.
      '@typescript-eslint/restrict-template-expressions': ['error', { allowNumber: true, allowBoolean: true }],
      // Av: regeln motarbetar legitima defensiva kontroller av externdata/`any`-data.
      // Övriga typmedvetna regler är fortsatt på.
      '@typescript-eslint/no-unnecessary-condition': 'off',
      // Av: dessa React-mönsterregler (inte typsäkerhet) slår på det avsiktliga
      // "hämta i effekt → setState"-mönstret som hookarna här använder.
      'react-hooks/set-state-in-effect': 'off',
      'react-hooks/exhaustive-deps': 'off',
      // Av: React-kompilatorns "Compilation Skipped"-diagnostik för inkompatibla
      // tredjepartsbibliotek (@sk-web-gui) — kan inte åtgärdas i appkoden.
      'react-hooks/incompatible-library': 'off',
    },
  },
  // Måste ligga sist: stänger av stilregler som krockar med Prettier.
  eslintConfigPrettier,
);
