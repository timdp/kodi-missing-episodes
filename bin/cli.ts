#!/usr/bin/env -S node --loader ts-node/esm --experimental-specifier-resolution=node

import { fileURLToPath, URL } from 'node:url'

import fs from 'fs-extra'
import minimist from 'minimist'

import { run } from '../lib/main'
import { ConsoleReporter } from '../lib/reporters/ConsoleReporter'
import { StructuredReporter } from '../lib/reporters/StructuredReporter'

const argv = minimist(process.argv.slice(2))

const settingsPath = fileURLToPath(new URL('../settings.json', import.meta.url))
const settings = fs.readJsonSync(settingsPath)
const format: string = argv.format ?? settings.format
const verbose: boolean =
  typeof argv.verbose === 'boolean' ? argv.verbose : settings.verbose

const ReporterImpl = ['json', 'yaml'].includes(format)
  ? StructuredReporter
  : ConsoleReporter
const reporter = new ReporterImpl({ format, verbose })

run(settings, reporter)
