# kodi-missing-episodes

[![JavaScript Standard Style](https://img.shields.io/badge/code%20style-standard-brightgreen.svg)](https://standardjs.com/)

Checks your Kodi TV library for missing episodes using Trakt.

## Requirements

* [Node.js](https://nodejs.org/)
* Kodi with the [JSON-RPC API enabled](http://kodi.wiki/view/JSON-RPC_API#Enabling_JSON-RPC)
* API credentials for [Trakt](https://trakt.tv/)

## Installation

```bash
$ git clone https://github.com/timdp/kodi-missing-episodes.git
$ cd kodi-missing-episodes
$ npm install
```

## Usage

1. Copy `settings-example.json` to `settings.json`
2. Enter your credentials for Kodi and Trakt in `settings.json`
3. Run `npm start`

## Author

[Tim De Pauw](https://tmdpw.eu/)

## License

MIT
