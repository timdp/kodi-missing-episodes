# kodi-missing-episodes

[![JavaScript Standard Style](https://img.shields.io/badge/code%20style-standard-brightgreen.svg)](https://standardjs.com/)

Checks your Kodi (XBMC) TV library for missing episodes using TheTVDB.com.

## Requirements

* [Node.js](https://nodejs.org/)
* Kodi with the [JSON-RPC API enabled](http://kodi.wiki/view/JSON-RPC_API#Enabling_JSON-RPC)
* API credentials for [TheTVDB.com](https://thetvdb.com/)

## Installation

```bash
$ git clone https://github.com/timdp/kodi-missing-episodes.git
$ cd kodi-missing-episodes
$ npm install
```

## Usage

1. Copy `config.json.example` to `config.json`
2. Enter your credentials for Kodi and TheTVDB.com in `config.json`
3. Run `node kodi-missing-episodes.js`

## Author

[Tim De Pauw](https://tmdpw.eu/)

## License

MIT
