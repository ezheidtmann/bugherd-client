bhapi = require('./');

bhapi.setKey('your_api_key_here');

bhapi.get('projects').then(function(data) {
  data.projects.forEach(function(proj) {
    bhapi.get('projects/'+ proj.id).then(function(project) {
      console.log(project);
    });
  });
})
.catch(Error, function(err) {
  console.log(err.message);
});
