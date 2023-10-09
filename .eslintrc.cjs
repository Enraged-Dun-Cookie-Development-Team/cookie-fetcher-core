module.exports = {
  root: true,
  env: {
    es2022: true,
  },
  // 全局加载的默认规则
  extends: ['eslint:recommended'],
  overrides: [
    // typescript配置
    {
      files: ['./**/*.ts'],
      env: {
        'shared-node-browser': true,
      },
      plugins: ['@typescript-eslint'],
      extends: ['plugin:@typescript-eslint/recommended', 'plugin:@typescript-eslint/recommended-requiring-type-checking', 'prettier'],
      parser: '@typescript-eslint/parser',
      parserOptions: {
        project: ['./tsconfig.json'],
      },
      rules: {
        '@typescript-eslint/no-non-null-assertion': 'off', // 允许强制非空操作符，这样在部分情况下可以减少一点类型定义，但是使用时要自行确保它确实非空
        '@typescript-eslint/explicit-member-accessibility': ['warn', { accessibility: 'no-public' }], //
      },
    },
    // nodejs
    {
      files: ['run/**/*.ts'],
      env: {
        node: true,
      },
    },
    // 测试文件
    {
      files: ['test/**/*.ts'],
      plugins: ['jest'],
      extends: ['plugin:jest/recommended'],
      env: {
        node: true,
        jest: true,
      },
    },
    // 配置文件(通用设置)
    {
      files: ['.eslintrc.cjs', './*.config.{js,cjs,mjs}'],
      env: {
        node: true,
      },
    },
    // 配置文件(esm格式的特殊设置)
    {
      files: ['jest.config.js', 'rollup.config.js', 'rollup-server.config.js'],
      parserOptions: {
        sourceType: 'module',
      },
    },
  ],
};
