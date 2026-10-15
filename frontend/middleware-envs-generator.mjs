import { config } from 'dotenv';
import { writeFileSync } from 'node:fs';

config({ path: ['./.env.local', './.env'], quiet: true });

const outputContent = `export const envs = {
  protectedRoutes: '${process.env.NEXT_PUBLIC_PROTECTED_ROUTES || ''}',
  adminUrl: '${process.env.ADMIN_URL || ''}',
  basePath: '${process.env.NEXT_PUBLIC_BASE_PATH || ''}',
  apiUrl: '${process.env.API_URL_INTERNAL || process.env.NEXT_PUBLIC_API_URL || ''}',
  sessionCookieName: '${process.env.NEXT_PUBLIC_SESSION_COOKIE_NAME || 'connect.sid'}',
};\n`;

try {
  writeFileSync('./middleware-envs.js', outputContent, 'utf8');
  console.log('middleware-envs.js has been generated successfully.');
} catch (error) {
  console.error('Error writing to middleware-envs.js:', error);
  process.exit(1);
}
