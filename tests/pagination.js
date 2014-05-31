var test = require('tape');
var rest = require('rest');
var client = require('rest/client');
var url = require('url');
var responsePromise = require('rest/util/responsePromise');
var _ = require('underscore');
var bhapi = require('../index.js');


var per_page = 100;
var project_list = [];
var request_counter = 0;

function mockClient(request) {
  return new responsePromise.ResponsePromise(function(resolve, reject) {
    request_counter++;

    var data = {
      projects: []
     ,meta: { count: project_list.length }
    };

    var uri = url.parse(request.path, true);
    var page = (uri.query && uri.query.page) || 1;
    var from_i = (page-1) * 100;
    var to_i = (page) * 100;

    data.projects = project_list.slice(from_i, to_i);

    var response = {
      request: request
     ,entity: data
    };

    resolve(response);
  });
}
rest.setDefaultClient(mockClient);

bhapi.setDelay(0);

test('paginated results should be depaginated', function(t) {
  t.plan(3);

  request_counter = 0;
  project_list = _.times(412, function(n) {
    return { project_id: n, name: "Project #"+ n };
  });

  bhapi.get('projects').then(function(data) {
    t.equal(data.projects.length, project_list.length, 'project count matches');
    t.deepEqual(data.projects, project_list, 'project details match');
    t.equal(request_counter, Math.ceil(project_list.length / per_page), 'correct number of requests');
  });
});

test('less than 100 results should do one request', function(t) {
  t.plan(3);

  project_list = [ { project_id: 1 }, { project_id: 2 } ];

  request_counter = 0;
  bhapi.get('projects').then(function(data) {
    t.equal(data.projects.length, project_list.length, 'project count matches');
    t.deepEqual(data.projects, project_list, 'project details match');
    t.equal(request_counter, 1, 'exactly one request');
  });
});

test('even multiples of 100 results should do minimum number of requests', function(t) {
  t.plan(6);

  request_counter = 0;
  project_list = _.times(100, function(n) { return { project_id: n }; });
  bhapi.get('projects').then(function(data) {
    t.equal(data.projects.length, project_list.length, 'project count ' + project_list.length);
    t.deepEqual(data.projects, project_list, 'project details match');
    t.equal(request_counter, 1, 'exactly one request');
  }).then(function() {
    request_counter = 0;
    project_list = _.times(300, function(n) { return { project_id: n }; });
    bhapi.get('projects').then(function(data) {
      t.equal(data.projects.length, project_list.length, 'project count ' + project_list.length);
      t.deepEqual(data.projects, project_list, 'project details match');
      t.equal(request_counter, 3, 'exactly three requests');
    });
  });
});
