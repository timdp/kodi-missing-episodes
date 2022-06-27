#!/usr/bin/env -S node --loader ts-node/esm --experimental-specifier-resolution=node

import minimist from 'minimist'

import { run } from '../lib/main'
import { ConsoleReporter } from '../lib/reporters/ConsoleReporter'
import { JsonReporter } from '../lib/reporters/JsonReporter'
import settings from '../settings.json'

const argv = minimist(process.argv.slice(2))

const json: boolean = argv.json || settings.output === 'json'
const verbose: boolean =
  typeof argv.verbose === 'boolean' ? argv.verbose : settings.verbose
const ReporterImpl = json ? JsonReporter : ConsoleReporter
const reporter = new ReporterImpl({ verbose })

run(settings, reporter)
