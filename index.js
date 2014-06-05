var _ = require('underscore')
  , rest = require('rest')
  , throttler = require('rest-throttler')
  , qs = require('querystring')
  , url = require('url')
  , interceptor = require('rest/interceptor')
  , when = require('when')
  ;

var auth = {
  username: ''
 ,password: 'x'
};

/**
 * Depaginating interceptor for BugHerd API
 */
var bh_depaginator = interceptor({
  init: function(config) {
    config.per_page = config.per_page || 100;
    return config;
  }
 ,success: function(response, config, meta) {
    var result = response.entity
      , request = response.request
      ;

    // depagination: if it has a "meta.count", it is a candidate for
    // depagination. If we can figure out the data key and the count of actual
    // data elements differs from "meta.count", then we submit more requests
    // for other pages.
    if (result && result.meta && result.meta.count) {
      var otherkeys = _.without(_.keys(result), 'meta');
      var datakey = otherkeys.length == 1 ? otherkeys[0] : null;
      if (datakey) {
        request.bh_pages = request.bh_pages || [];

        // Compute number of results retrieved thus far
        var count_this_request = result[datakey].length;
        var count_until_now = request.bh_pages.length * config.per_page;

        request.bh_pages.push(result);

        // If we haven't yet retrieved all the results, get another page.
        if (count_this_request + count_until_now < result.meta.count) {
          var uri = url.parse(request.path, true);
          delete uri.search;
          uri.query = uri.query || {};
          uri.query.page = uri.query.page || 1;
          // See if we need to go to the next page
          uri.query.page++;
          request.path = url.format(uri);
          return meta.client(request);
        }

        // This might be a paginated response; make sure the user's response
        // includes the data from the other pages.
        result[datakey] = _.flatten(_.pluck(request.bh_pages, datakey));
      }
    }

    return when(response);
  }
});

var throttler_config = { limit: throttler.limit(3000) };
var rate_limited_request = rest
  // Decode JSON automatically
  .wrap(require('rest/interceptor/mime'), { mime: 'application/json' })
  // Mark 429 ("rate limit exceeded") as errors so we can back off and retry.
  .wrap(require('rest/interceptor/errorCode'), { code: 429 })
  // Backoff 4 seconds if receive an error
  .wrap(require('rest/interceptor/retry'), { initial: 4e3 })
  // Mark all 400+ responses as errors (after retrying)
  .wrap(require('rest/interceptor/errorCode'), { code: 400 })
  // timeout after 2 minutes
  .wrap(require('rest/interceptor/timeout'), { timeout: 120e3 })
  // Use our API key
  .wrap(require('rest/interceptor/basicAuth'), auth)
  // Always wait between requests (3 seconds per BH api)
  .wrap(throttler, throttler_config)
  .chain(bh_depaginator, {})
  ;

/**
 * Get something from the Bugherd API
 *
 * @param path Partial API path, after "/api_v2" and before ".json". Required.
 * @param args Optional querystring arguments, as object.
 *
 * @returns Promise
 * @resolves with response body
 * @rejects with Error('API Error:' + ...);
 *
 * @see bh_req()
 */
function bh_get(path, args) {
  var uri = 'https://www.bugherd.com/api_v2/' + path + '.json';
  uri = url.parse(uri, true);
  uri.query = args || {};

  var should_depaginate = true;
  if (uri.query.page) {
    should_depaginate = false;
    // TODO: use this in the depaginator
  }

  return bh_req(url.format(uri));
}

/**
 * Post something to the Bugherd API
 *
 * @param path Partial API path, after "/api_v2" and before ".json". Required.
 * @param body POST request body, will be sent as JSON.
 *
 * @returns Promise
 * @resolves with response body
 * @rejects with Error('API Error:' + ...);
 *
 * @see bh_req()
 */
function bh_post(path, body, method) {
  method = method || 'POST';

  var uri = 'https://www.bugherd.com/api_v2/' + path + '.json';

  var req = {
    path: uri
   ,entity: body
   ,method: method
  };

  return bh_req(req);
}

/**
 * PUT something to the Bugherd API
 */
function bh_put(path, body) {
  bh_post(path, body, 'PUT');
}

function bh_req(req) {
  return rate_limited_request(req).then(function(response) {
    return response.entity;
  })
  .catch(function(response) {
    var msg = 'Unknown Error';
    if (response.entity.error) {
      msg = response.status.code + ': ' + response.entity.error;
    }
    throw new Error('API Error: '+ msg);
  });
}

module.exports = {
  get: bh_get
 ,post: bh_post
 ,put: bh_put
 ,auth: auth
 ,setKey: function(key) { auth.username = key; }
 ,depaginator: bh_depaginator
 ,setDelay: function(msecs) { throttler_config.limit.delay = msecs; }
}
