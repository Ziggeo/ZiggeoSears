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
