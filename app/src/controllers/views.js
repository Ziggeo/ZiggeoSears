App.Controllers.Controller.extend("App.Controllers.ViewsController", {}, {

	index : function(request, response, callbacks) {
		response.render('index.html.erb', {
			query: "",
			results : [],
			error: null
		});
		callbacks.success();
	},

	search : function(request, response, callbacks) {
		App.Services.SearsService.query(request.body.query, {
			success: function (results) {
				response.render('index.html.erb', {
					query: request.body.query,
					results : results,
					error: null
				});
				callbacks.success();
			}, exception: function () {
				response.render('index.html.erb', {
					query: request.body.query,
					results : [],
					error: "Sears Product Search API sometimes has cache failures and returns an empty document instead of valid JSON or XML. That just happened. Sorry about that :-(."
				});
				callbacks.success();
			}
		});
	},

	product : function(request, response, callbacks) {
		var sears_promise = BetaJS.SyncAsync.promise(App.Services.SearsService, App.Services.SearsService.get, [request.params.product_id]);
		var mongo_promise = BetaJS.SyncAsync.promise(App.Services.ReviewsService, App.Services.ReviewsService.index, [request.params.product_id]);
		BetaJS.SyncAsync.join([sears_promise, mongo_promise], BetaJS.SyncAsync.mapSuccess(callbacks, function(product, review_data) {
			response.render('product.html.erb', {
				product : product,
				reviews : review_data.reviews,
				rating: review_data.rating,
				title : product.Description.DescriptionName
			});
			callbacks.success();
		}));
	}
});
