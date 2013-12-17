function createUrl(credentialToken) {
	return "https://raven.cam.ac.uk/auth/authenticate.html"
		+ "?ver=" + encodeURIComponent(3)
		+ "&url=" + encodeURIComponent(Meteor.absoluteUrl('_raven'))
		+ "&params=" + encodeURIComponent(credentialToken);
}

Meteor.loginWithRaven = function(options, callback) {
	if (!callback && typeof options === "function") {
		callback = options;
		options = null;
	}
	
	var credentialToken = Random.id();
	
	var popup = openCenteredPopup(createUrl(credentialToken), 600, 500);
	
	var checkPopupOpen = setInterval(function() {
		try {
			// Fix for #328 - added a second test criteria (popup.closed === undefined)
			// to humour this Android quirk:
			// http://code.google.com/p/android/issues/detail?id=21061
			var popupClosed = popup.closed || popup.closed === undefined;
		} catch (e) {
			// For some unknown reason, IE9 (and others?) sometimes (when
			// the popup closes too quickly?) throws "SCRIPT16386: No such
			// interface supported" when trying to read 'popup.closed'. Try
			// again in 100ms.
			return;
		}

		if (popupClosed) {
			clearInterval(checkPopupOpen);
			
			if(credentialToken && credentialToken instanceof Error) {
				callback && callback(credentialToken);
			} else {
				Accounts.callLoginMethod({
					'methodArguments': [{'raven': {'credentialToken': credentialToken}}],
					'userCallback': callback && function (err) {
						if (err && err instanceof Meteor.Error &&
							err.error === Accounts.LoginCancelledError.numericError) {
							callback(new Accounts.LoginCancelledError(err.details));
						} else {
							callback(err);
						}
					}
				});
			}
		}
	}, 100)
}

var openCenteredPopup = function(url, width, height) {
	var screenX = typeof window.screenX !== 'undefined'
		? window.screenX : window.screenLeft;
	var screenY = typeof window.screenY !== 'undefined'
		? window.screenY : window.screenTop;
	var outerWidth = typeof window.outerWidth !== 'undefined'
		? window.outerWidth : document.body.clientWidth;
	var outerHeight = typeof window.outerHeight !== 'undefined'
		? window.outerHeight : (document.body.clientHeight - 22);
	// XXX what is the 22?

	// Use `outerWidth - width` and `outerHeight - height` for help in
	// positioning the popup centered relative to the current window
	var left = screenX + (outerWidth - width) / 2;
	var top = screenY + (outerHeight - height) / 2;
	var features = ('width=' + width + ',height=' + height +
		',left=' + left + ',top=' + top + ',scrollbars=yes');

	var newwindow = window.open(url, 'Login', features);
	if (newwindow.focus)
		newwindow.focus();
	return newwindow;
};

var oldServiceNames = Accounts.oauth.serviceNames;
Accounts.oauth.serviceNames = function() {
	var result = oldServiceNames();
	result.push('raven');
	return result;
};
