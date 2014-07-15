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
