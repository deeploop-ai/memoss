#!/usr/bin/env node
import { runCli } from './cli.js';
import { handleCommandError } from './utils/errors.js';

runCli(process.argv.slice(2)).catch(handleCommandError);
