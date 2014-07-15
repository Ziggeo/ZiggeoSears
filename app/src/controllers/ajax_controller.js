App.Controllers.Controller.extend("App.Controllers.AjaxController", {}, {

	foursquare: function (request, response, callbacks) {
		App.Services.FoursquareService.closest_venue(request.query.latitude, request.query.longitude, "Sears", BetaJS.SyncAsync.mapSuccess(callbacks, function (venue) {
			if (App.Services.FoursquareService.is_venue_close(venue)) {
				response.send(JSON.stringify({
					link: App.Services.FoursquareService.get_venue_link(venue),
					found: true
				}));
			} else {
				response.send(JSON.stringify({
					link: App.Services.FoursquareService.get_venue_explore(request.query.latitude, request.query.longitude, "Sears"),
					found: false
				}));
			} 
			callbacks.success();
		})); 
	},
	
	review: function (request, response, callbacks) {
		var review = request.body;
		if (review.data)
			review = review.data;
		App.Services.ReviewsService.create(review, BetaJS.SyncAsync.mapSuccess(callbacks, function () {
			response.send({});
			callbacks.success();
		}));
	}
	
});