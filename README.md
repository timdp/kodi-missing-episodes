kodi-missing-episodes
=====================

Checks your Kodi (XBMC) TV library for missing episodes using TheTVDB.com.

Requirements
------------

* [Node.js](http://nodejs.org/)
* Kodi with the [JSON-RPC API enabled](http://kodi.wiki/view/JSON-RPC_API#Enabling_JSON-RPC)
* An API key for [TheTVDB.com](http://thetvdb.com/)

Installation
------------

```bash
$ git clone https://github.com/timdp/kodi-missing-episodes.git
$ cd kodi-missing-episodes
$ npm install
```

Usage
-----

1. Copy `config.json.example` to `config.json`
2. Enter your credentials for Kodi and TheTVDB.com in `config.json`
3. Run `node kodi-missing-episodes.js`

Author
------

[Tim De Pauw](https://tmdpw.eu/)

License
-------

Copyright &copy; 2015 Tim De Pauw

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
