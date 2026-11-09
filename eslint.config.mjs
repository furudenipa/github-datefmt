import js from '@eslint/js';
import globals from 'globals';

export default [
  { ignores: ['node_modules/**'] },
  js.configs.recommended,
  {
    files: ['extension/**/*.js'],
    languageOptions: { sourceType: 'script', globals: globals.browser },
    rules: {
      'no-eval': 'error',
      'no-new-func': 'error',
      'no-restricted-globals': ['error',
        ...['fetch', 'XMLHttpRequest', 'WebSocket', 'EventSource', 'WebTransport', 'RTCPeerConnection', 'Worker', 'SharedWorker'].map(name => ({
          name, message: '拡張機能に通信機能を追加しないでください。',
        })),
      ],
      'no-restricted-syntax': ['error', {
        selector: 'MemberExpression:not([computed=true])[property.name=/^(fetch|XMLHttpRequest|WebSocket|EventSource|WebTransport|RTCPeerConnection|sendBeacon|Worker|SharedWorker)$/], MemberExpression[computed=true][property.value=/^(fetch|XMLHttpRequest|WebSocket|EventSource|WebTransport|RTCPeerConnection|sendBeacon|Worker|SharedWorker)$/]',
        message: '拡張機能に通信機能を追加しないでください。',
      }],
    },
  },
  {
    files: ['scripts/**/*.mjs', 'tests/**/*.mjs', 'eslint.config.mjs'],
    languageOptions: { globals: globals.node },
  },
];
