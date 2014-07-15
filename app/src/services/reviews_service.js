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
