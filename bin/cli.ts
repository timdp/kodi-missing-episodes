#!/usr/bin/env -S node --loader ts-node/esm --experimental-specifier-resolution=node

import minimist from 'minimist'

import { run } from '../lib/main'
import { ConsoleReporter } from '../lib/reporters/ConsoleReporter'
import { StructuredReporter } from '../lib/reporters/StructuredReporter'
import settings from '../settings.json'

const argv = minimist(process.argv.slice(2))

const format: string = argv.format ?? settings.format
const verbose: boolean =
  typeof argv.verbose === 'boolean' ? argv.verbose : settings.verbose

const ReporterImpl = ['json', 'yaml'].includes(format)
  ? StructuredReporter
  : ConsoleReporter
const reporter = new ReporterImpl({ format, verbose })

run(settings, reporter)
