import config from "@krgeobuk/eslint-config/nest";

export default config;

// import tseslint from 'typescript-eslint';
// import globals from 'globals';
// import prettier from 'eslint-config-prettier';

// export default [
//   {
//     ignores: ['dist', 'node_modules'], // 기존 .eslintignore 대체
//   },
//   {
//     files: ['**/*.{ts,js}'],
//     languageOptions: {
//       parser: tseslint.parser,
//       parserOptions: {
//         project: './tsconfig.json',
//       },
//       globals: {
//         ...globals.node,
//       },
//     },
//     plugins: {
//       '@typescript-eslint': tseslint.plugin,
//     },
//     rules: {
//       // 원하는 룰 추가
//     },
//   },
//   ...tseslint.configs.recommended,
//   prettier, // prettier 설정을 맨 마지막에 추가
// ];
