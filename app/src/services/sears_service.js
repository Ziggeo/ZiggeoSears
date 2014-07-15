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