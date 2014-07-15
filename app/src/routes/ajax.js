App.Globals.express.get('/ajax/foursquare', function (request, response) {
	App.Controllers.AjaxController.dispatch("foursquare", request, response);
});

App.Globals.express.post('/ajax/review', function (request, response) {
	App.Controllers.AjaxController.dispatch("review", request, response);
});
