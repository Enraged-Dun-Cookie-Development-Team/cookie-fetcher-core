import { execSync } from 'child_process';
import presets from 'ts-jest/presets/index.js';
import path from 'path';
import { fileURLToPath } from 'url';

if (process.platform === 'win32') {
  // win上必须调整编码页以避免输出日志乱码
  // noinspection SpellCheckingInspection
  execSync('chcp 65001');
}

const transform = {};
// 使用预设里面的key以保证覆盖配置(所以说他用正则作为key真的很怪啊，谁知道这个默认配置版本更新的时候会不会突然修改正则)
transform[Object.keys(presets.defaultsESM.transform)[0]] = [
  'ts-jest',
  {
    useESM: true,
    tsconfig: './tsconfig.json',
  },
];

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// noinspection JSUnusedGlobalSymbols
/** @type {import('ts-jest/dist/types').InitialOptionsTsJest} */
export default {
  preset: 'ts-jest/presets/default-esm',
  testEnvironment: 'node',
  roots: ['<rootDir>/src', '<rootDir>/test'],
  testMatch: ['**/test/**/*.ts', '!**/test/utils/**'],
  transform: transform,
  moduleNameMapper: {
    '^(\\.{1,2}/.*)\\.js$': '$1',
  },
  reporters: ['default', ['jest-html-reporters', { publicPath: `${__dirname}${path.sep}report`, expand: true }]],
  collectCoverage: true,
  coverageReporters: ['html-spa', 'text'],
  coveragePathIgnorePatterns: ['/node_modules/', '<rootDir>/test/'],
};
