#!/usr/bin/env node
import { CORE_VERSION } from '@memoss/core';

const [, , command] = process.argv;

if (command === '--version' || command === '-v') {
  console.log(`memoss ${CORE_VERSION}`);
  process.exit(0);
}

console.log('memoss — agent-native knowledge runtime (scaffold)');
console.log(`core ${CORE_VERSION}`);
console.log('Run `memoss --help` after M5 CLI implementation.');
