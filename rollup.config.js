import { defineConfig } from 'rollup';
import typescript from '@rollup/plugin-typescript';
import del from 'rollup-plugin-delete';
import copy from 'rollup-plugin-copy';
import { execSync } from 'child_process';

// noinspection JSUnusedGlobalSymbols
export default defineConfig([
  {
    input: {
      index: 'src/index.ts',
    },
    output: { dir: 'dist', format: 'cjs', sourcemap: true },
    external: [
      'json5',
      'clone',
      'luxon',
      'eventemitter2',
      'ajv',
      'ajv-formats',
      '@stoplight/json-ref-resolver',
      '@sinclair/typebox',
      'rfc6902',
      '@enraged-dun-cookie-development-team/common/json',
      '@enraged-dun-cookie-development-team/common/request',
    ],
    plugins: [
      del({ targets: 'dist/**' }),
      typescript({
        tsconfig: 'tsconfig-prod.json',
      }),
      copy({
        targets: [
          {
            src: '.npmrc',
            dest: 'dist',
          },
          {
            src: 'package.json',
            dest: 'dist',
            transform: (contents) => {
              const content = JSON.parse(contents.toString());
              content.main = 'index.js';
              content.module = 'index.esm.js';
              content.types = 'index.d.js';
              content.repository = 'https://github.com/Enraged-Dun-Cookie-Development-Team/cookie-fetcher';
              const buildNumber = process.env.BUILD_NUMBER === 'dev' ? 'dev' : parseInt(process.env.BUILD_NUMBER || 'NaN');
              if (!(buildNumber > 0) && buildNumber !== 'dev') {
                throw new Error(`无效环境变量BUILD_NUMBER：${process.env.BUILD_NUMBER}`);
              }
              let hash;
              try {
                hash = execSync('git rev-parse --short HEAD').toString().trim();
              } catch (e) {
                throw new Error(`获取git hash失败：${e.message}`, e);
              }
              if (hash.length < 7 || hash.length > 12) {
                throw new Error(`获取git hash失败，获取到无效的hash：${hash}`);
              }
              content.version = `${content.version}.${buildNumber}+${hash}`;
              delete content['type'];
              delete content['scripts'];
              delete content['lint-staged'];
              return JSON.stringify(content, null, 2);
            },
          },
        ],
      }),
    ],
  },
  {
    input: {
      'index.esm': 'src/index.ts',
    },
    output: { dir: 'dist', format: 'esm', sourcemap: true },
    external: [
      'json5',
      'clone',
      'luxon',
      'eventemitter2',
      'ajv',
      'ajv-formats',
      '@stoplight/json-ref-resolver',
      '@sinclair/typebox',
      'rfc6902',
      '@enraged-dun-cookie-development-team/common/json',
      '@enraged-dun-cookie-development-team/common/request',
    ],
    plugins: [
      typescript({
        tsconfig: 'tsconfig-prod.json',
      }),
    ],
  },
]);
