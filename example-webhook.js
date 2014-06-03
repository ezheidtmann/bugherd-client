bhapi = require('./');

bhapi.setKey('your_api_key_here');

bhapi.post('webhooks', {
  target_url: 'http://requestb.in/ti83eati'
 ,event: 'task_update'
}).then(function(data) {
  console.log(data);
});
