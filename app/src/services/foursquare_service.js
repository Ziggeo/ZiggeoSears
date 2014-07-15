App.Services.FoursquareService = {

	__foursquarevenues: (require('foursquarevenues'))(App.Config.foursquare_client_id, App.Config.foursquare_client_secret),

	closest_venue: function (latitude, longitude, name, callbacks) {
		this.__foursquarevenues.getVenues({
			"ll" : latitude + "," + longitude,
			"query" : name
		}, function(error, result) {
			if (error) {
				BetaJS.SyncAsync.callback(callbacks, "exception", error);
				return;
			}
			var venue = result && result.response && result.response.venues ? result.response.venues[0] : null; 
			BetaJS.SyncAsync.callback(callbacks, "success", venue);
		}); 
	},
	
	is_venue_close: function (venue) {
		return venue && venue.location && venue.location.distance <= 500; 
	},
	
	get_venue_link: function (venue) {
		return "https://foursquare.com/v/" + venue.id;
	},
	
	get_venue_explore: function(latitude, longitude, name) {
		return "https://foursquare.com/explore?ll=" + latitude + "," + longitude + "&q=" + name;
	}
	
};
