import { defineConfig } from 'vite';
import uni from '@dcloudio/vite-plugin-uni';
import { fileURLToPath } from 'node:url';
import { readLocalLoginConfig, writeLocalLoginConfigModule } from './build/local-login-config.mjs';

const localLoginConfig = readLocalLoginConfig(fileURLToPath(new URL('./common/local.credentials.json', import.meta.url)));
writeLocalLoginConfigModule(fileURLToPath(new URL('./common/local.credentials.module.ts', import.meta.url)), localLoginConfig);

export default defineConfig({
	plugins: [uni({
		autoImportOptions: {
			ignore: ['h']
		}
	})],
});
