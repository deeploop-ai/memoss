#!/usr/bin/env node
import { runMain } from 'citty';
import { mainCommand } from './cli.js';
import { handleCommandError } from './utils/errors.js';

runMain(mainCommand).catch(handleCommandError);
