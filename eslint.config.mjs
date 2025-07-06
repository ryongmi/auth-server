import config from '@krgeobuk/eslint-config/nest';

export default [
  ...config,

  {
    // eslint 설정 확장
    settings: {
      'import/resolver': {
        typescript: {
          project: './tsconfig.json',
        },
      },
    },
  },
  {
    files: ['**/*.{js,cjs,ts}'],
    languageOptions: {
      parserOptions: {
        project: './tsconfig.json', // 타입 체킹 활성화
      },
    },
  },
];
