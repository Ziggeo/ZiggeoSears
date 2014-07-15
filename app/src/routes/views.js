App.Globals.express.get('/', function (request, response) {
	App.Controllers.ViewsController.dispatch("index", request, response);
});

App.Globals.express.post('/', function (request, response) {
	App.Controllers.ViewsController.dispatch("search", request, response);
});

App.Globals.express.get('/products/:product_id', function (request, response) {
	App.Controllers.ViewsController.dispatch("product", request, response);
});
