import path from 'path';

// Generated API clients are never hand-edited.
const isGenerated = (file) => file.split(path.sep).join('/').includes('/data-contracts/');

const tasksFor =
  (pkg, setup = []) =>
  (files) => {
    const cwd = path.resolve(pkg);
    const relativePaths = files
      .filter((file) => !isGenerated(file))
      .map((file) => path.relative(cwd, file).split(path.sep).join('/'));
    if (relativePaths.length === 0) return [];
    const joined = relativePaths.join(' ');
    return [
      ...setup,
      `yarn --cwd ${pkg} prettier --write ${joined}`,
      `yarn --cwd ${pkg} eslint --no-error-on-unmatched-pattern --no-warn-ignored --fix --max-warnings=0 ${joined}`,
    ];
  };

export default {
  // Type-aware lint resolves src/proxy.ts, which imports the gitignored middleware-envs.js.
  'frontend/{src,e2e,tests}/**/*.{ts,tsx}': tasksFor('frontend', ['yarn --cwd frontend generate:middleware-envs']),
  'backend/src/**/*.ts': tasksFor('backend'),
};
