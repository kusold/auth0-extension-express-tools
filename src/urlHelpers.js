const url = require('url');

const USE_WILDCARD_DOMAIN = 3;
const USE_CUSTOM_DOMAIN = 2;
const USE_SHARED_DOMAIN = 1;
const SANITIZE_RX = /[\-\[\]\/\{\}\(\)\*\+\?\.\\\^\$\|]/g; // eslint-disable-line no-useless-escape

const getBasePath = function(originalUrl, path) {
  var basePath = url.parse(originalUrl).pathname || '';
  basePath = basePath.replace(path, '')
    .replace(/^\/|\/$/g, '');
  if (!basePath.startsWith('/')) {
    basePath = '/' + basePath;
  }
  if (!basePath.endsWith('/')) {
    basePath += '/';
  }
  return basePath;
};

module.exports.getBasePath = function(req) {
  return getBasePath(req.originalUrl || '', req.path);
};

module.exports.getBaseUrl = function(req, protocol) {
  var urlProtocol = protocol;
  if (!urlProtocol && process.env.NODE_ENV === 'development') {
    urlProtocol = 'http';
  }

  const originalUrl = url.parse(req.originalUrl || '').pathname || '';
  return url.format({
    protocol: urlProtocol || 'https',
    host: req.headers.host,
    pathname: originalUrl.replace(req.path, '').replace(/\/$/g, '')
  });
};

function createRouteNormalizationRx(claims) {
  if (!claims.container) {
    return null;
  }

  const container = claims.container.replace(SANITIZE_RX, '\\$&');
  const name = claims.jtn
      ? claims.jtn.replace(SANITIZE_RX, '\\$&')
      : '';

  if (claims.url_format === USE_SHARED_DOMAIN) {
    return new RegExp('^/api/run/' + container + '/(?:' + name + '/?)?');
  } else if (claims.url_format === USE_CUSTOM_DOMAIN) {
    return new RegExp('^/' + container + '/(?:' + name + '/?)?');
  } else if (claims.url_format === USE_WILDCARD_DOMAIN) {
    return new RegExp('^/(?:' + name + '/?)?');
  }

  throw new Error('Unsupported webtask URL format.');
}

module.exports.getWebtaskUrl = function(req) {
  const normalizeRouteRx = createRouteNormalizationRx(req.x_wt);
  const requestOriginalUrl = req.url;
  const requestUrl = req.url.replace(normalizeRouteRx, '/');
  const requestPath = url.parse(requestUrl || '').pathname;
  const isIsolatedDomain = (req.x_wt && req.x_wt.ectx && req.x_wt.ectx.ISOLATED_DOMAIN) || false;
  const originalUrl = url.parse(requestOriginalUrl || '').pathname || '';

  var webtaskUrl;
  if (!isIsolatedDomain) {
    webtaskUrl = originalUrl;
  } else {
    webtaskUrl = url.format({
      protocol: 'https',
      host: req.headers.host,
      pathname: originalUrl.replace(requestPath, '').replace(/\/$/g, '')
    });

    if (webtaskUrl.indexOf('https://sandbox.it.auth0.com') === 0) {
      webtaskUrl = webtaskUrl.replace('https://sandbox.it.auth0.com/api/run/' + req.x_wt.container + '/', 'https://' + req.x_wt.container + '.us.webtask.io/');
    } else if (webtaskUrl.indexOf('https://sandbox-eu.it.auth0.com') === 0) {
      webtaskUrl = webtaskUrl.replace('https://sandbox-eu.it.auth0.com/api/run/' + req.x_wt.container + '/', 'https://' + req.x_wt.container + '.eu.webtask.io/');
    } else if (webtaskUrl.indexOf('https://sandbox-au.it.auth0.com') === 0) {
      webtaskUrl = webtaskUrl.replace('https://sandbox-au.it.auth0.com/api/run/' + req.x_wt.container + '/', 'https://' + req.x_wt.container + '.au.webtask.io/');
    } else if (webtaskUrl.indexOf('https://us-test.wt.auth0.net') === 0) {
      webtaskUrl = webtaskUrl.replace('https://us-test.wt.auth0.net/api/run/' + req.x_wt.container + '/', 'https://' + req.x_wt.container + '.us.webtask.io/');
    }
  }


  return webtaskUrl;
};
