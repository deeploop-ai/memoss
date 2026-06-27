import baseConfig from '../../eslint.config.mjs';
import jsoncEslintParser from 'jsonc-eslint-parser';

export default [
  ...baseConfig,
  {
    files: ['**/*.ts', '**/*.tsx', '**/*.js'],
    rules: {},
  },
  {
    files: ['*.json'],
    languageOptions: {
      parser: jsoncEslintParser,
    },
    rules: {
      '@nx/dependency-checks': [
        'error',
        {
          ignoredFiles: ['{projectRoot}/eslint.config.{js,cjs,mjs,ts,cts,mts}'],
          ignoredDependencies: [
            '@memoss/core',
            'vite',
            'react',
            'ink',
            'ink-text-input',
            'ink-spinner',
          ],
        },
      ],
    },
  },
];
