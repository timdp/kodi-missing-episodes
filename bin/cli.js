#!/usr/bin/env node

import minimist from 'minimist'
import fs from 'node:fs/promises'

import { run } from '../lib/main.js'
import { ConsoleReporter } from '../lib/reporters/ConsoleReporter.js'
import { JsonReporter } from '../lib/reporters/JsonReporter.js'

const argv = minimist(process.argv.slice(2))

const settingsFile = new URL('../settings.json', import.meta.url)
const settings = JSON.parse(await fs.readFile(settingsFile, 'utf8'))

const json = argv.json || settings.output === 'json'
const verbose =
  typeof argv.verbose === 'boolean' ? argv.verbose : settings.verbose
const ReporterImpl = json ? JsonReporter : ConsoleReporter
const reporter = new ReporterImpl({ verbose })

await run(settings, reporter)
