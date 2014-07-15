var BetaJS = require("../../libraries/betajs/dist/beta-server.js");

App = {};

App.Config = require('fs').existsSync(__dirname + "/../../config.js") ?
             require("../../config.js") :
             require("../../config.default.js");

App.Modules = {
	Express: require("express"),
	Morgan: require("morgan"),
	CookieParser: require("cookie-parser"),
	BodyParser: require("body-parser"),
	Erb: require("ejs"),
	Ziggeo: require("../../libraries/ziggeo/ziggeo-sdk.min.js")
};

App.Modules.Ziggeo.init(App.Config.ziggeo_token, App.Config.ziggeo_private_key);

App.Globals = {
	express: App.Modules.Express(),
	mongodb: new BetaJS.Databases.MongoDatabase(App.Config.mongodb, {sync: false, async: true})
};

App.Globals.review_table = new BetaJS.Databases.MongoDatabaseTable(App.Globals.mongodb, "reviews");
App.Globals.review_table.ensureIndex("product_id");

App.Services = {};

App.Globals.express.use(App.Modules.Morgan());
App.Globals.express.use(App.Modules.CookieParser(App.Config.cookie_key));
App.Globals.express.use(App.Modules.BodyParser());
App.Globals.express.engine('erb', App.Modules.Erb.renderFile);
App.Globals.express.set('views', __dirname + '/../src/views');
App.Globals.express.use(App.Modules.Express["static"](__dirname + '/../httpd'));

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

App.Services.ReviewsService = {

	create : function(review, callbacks) {
		review.date = BetaJS.Time.now();
		App.Globals.review_table.insertRow(review, callbacks);
		if (review.phone)
			App.Services.TwilioService.send_message(review.phone,
				"Thanks for submitting your video to SEARS Video Review Drawing. Winners will be announced every week.");
	},

	index : function(product_id, callbacks) {
		App.Globals.review_table.find({
			product_id : product_id
		}, {
			sort : {
				date : -1
			}
		}, BetaJS.SyncAsync.mapSuccess(callbacks, function(rows) {
			var result = rows.asArray();
			var avg = 0;
			for (var i = 0; i < result.length; ++i)
				avg += parseInt(result[i].rating, 10);
			if (result.length > 0)
				avg = avg / result.length;
			BetaJS.SyncAsync.callback(callbacks, "success", {
				reviews : result,
				rating : avg
			});
		}));
	}
};

App.Services.SearsService = {
	
	__ajax: new BetaJS.Server.Net.HttpAjax(),
	
	__xml2js: require("xml2js"),
	
	__cache: {},
	
	__json_parse: function (string) {
		var obj = JSON.parse(string);
		function helper(obj) {
			for (var key in obj) {
				var x = obj[key];
				if (BetaJS.Types.is_object(x))
					helper(x);
				else if (BetaJS.Types.is_string(x))
					obj[key] = x.replace(/<!\[CDATA\[/g, "").replace(/\]\]>/g, "");
			}
		}
		helper(obj);
		return obj;
	},
	
	__xml_parse: function (string) {
		if (!string)
			throw {};
		var r = null;
		this.__xml2js.parseString(string, function (err, result) {
			if (err)
				throw err;
			r = result;
		});
		return r;
	},
	
	__request: function (uris, cached, callbacks) {
		if (this.__cache[cached]) {
			BetaJS.SyncAsync.callback(callbacks, "success", this.__cache[cached]);
			return;
		}
		function tryuri(i) {
			if (i < uris.length) {
				this.__ajax.call({
					method: "GET",
					uri: "http://api.developer.sears.com/v2.1/" + uris[i],
					data: {
						apikey: App.Config.sears_key
					}
				}, {
					context: this,
					success: function (result) {
						try {
							result = this.__json_parse(result);
							this.__cache[cached] = result;
							BetaJS.SyncAsync.callback(callbacks, "success", result);
						} catch (e) {
							try {
								result = this.__xml_parse(result);
								this.__cache[cached] = result;
								BetaJS.SyncAsync.callback(callbacks, "success", result);
							} catch (e) {
								tryuri.call(this, i+1);
							}
						}
					}, exception: function () {
						tryuri.call(this, i+1);
					}
				});
			} else {
				BetaJS.SyncAsync.callback(callbacks, "exception", new App.Services.ServiceException(500, "Sears Api Result Malformed"));
			}
		}
		tryuri.call(this, 0);
	},
	
	query: function (query, callbacks) {
		query = query.toLowerCase();
		return this.__request([
				"products/search/Sears/json/keyword/" + query,
				"products/search/Sears/json/keyword/{" + query + "}",
				"products/search/Sears/xml/keyword/" + query,
				"products/search/Sears/xml/keyword/{" + query + "}"
		], "query:" + query, BetaJS.SyncAsync.mapSuccess(callbacks, function (results) {
			results = results.SearchResults && results.SearchResults.Products ? results.SearchResults.Products : {};
			if (results.length == 1 && results[0].Product) {
				results = results[0].Product;
				for (var i = 0; i < results.length; ++i)
					for (var k in results[i])
						results[i][k] = results[i][k][0];
			}
			BetaJS.SyncAsync.callback(callbacks, "success", results);
		}));
	},
	
	get: function (product_id, callbacks) {
		return this.__request([
			"products/details/Sears/json/" + product_id,
			"products/details/Sears/xml/" + product_id
		], "product:" + product_id, BetaJS.SyncAsync.mapSuccess(callbacks, function (results) {
			results = results.ProductDetail && results.ProductDetail.SoftHardProductDetails ? results.ProductDetail.SoftHardProductDetails : {};
			BetaJS.SyncAsync.callback(callbacks, "success", results);
		}));
	}
	
};
BetaJS.Exceptions.Exception.extend("App.Services.ServiceException", {
	
	constructor: function (code, data) {
		data = data || {};
		this.__data = data;
		this.__code = code;
		this._inherited(App.Services.ServiceException, "constructor", BetaJS.Net.HttpHeader.format(code, true));
	},
	
	code: function () {
		return this.__code;
	},
	
	data: function () {
		return this.__data;
	}
	
});

App.Services.TwilioService = {
	
	__client: require('twilio')(App.Config.twilio_sid, App.Config.twilio_auth),
	
	send_message: function (to, text) {
		this.__client.sendMessage({
			to: to,
			from: App.Config.twilio_phone,
			body: text
		}, function () {});
	}
	
};

BetaJS.Class.extend("App.Controllers.Controller", {}, {
	
	dispatch: function (method, request, response, next) {
		var self = this;
		self[method](request, response, {
			success: function () {
				if (BetaJS.Types.is_defined(next))
					next();
			},
			exception: function (e) {
				e = App.Services.ServiceException.ensure(e);
				response.status(e.code()).send(JSON.stringify(e.data()));
			}
		});
	}
		
});
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

App.Globals.express.get('/ajax/foursquare', function (request, response) {
	App.Controllers.AjaxController.dispatch("foursquare", request, response);
});

App.Globals.express.post('/ajax/review', function (request, response) {
	App.Controllers.AjaxController.dispatch("review", request, response);
});

App.Globals.express.get('/', function (request, response) {
	App.Controllers.ViewsController.dispatch("index", request, response);
});

App.Globals.express.post('/', function (request, response) {
	App.Controllers.ViewsController.dispatch("search", request, response);
});

App.Globals.express.get('/products/:product_id', function (request, response) {
	App.Controllers.ViewsController.dispatch("product", request, response);
});

App.Globals.express.listen(App.Config.server_port, function() {
	console.log("Listening on " + App.Config.server_port);
});