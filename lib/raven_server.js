var Fiber = Npm.require('fibers');
var url = Npm.require('url');
var crypto = Npm.require("crypto");

var serviceName = 'raven';
var activeTokens = {};

// Tokens should expire after 5 minutes
var tokenLife = 5*60;

WebApp.connectHandlers.use(function(req, res, next) {
	// Need to create a Fiber since we're using synchronous http calls and nothing
	// else is wrapping this in a fiber automatically
	Fiber(function () {
		middleware(req, res, next);
	}).run();
});

function wlsDecode(str) {
	return str.replace(/-/g, '+').replace(/\./g, '/').replace(/\_/g, '=');
}

function componentDecode(str) {
	return str.replace(/%21/g, '!').replace(/%25/g, '%');
}

function removeExpiredCredentials() {
	var now = (+new Date);
	
	_.each(activeTokens, function(result, token) {
		if (result.expires <= now)
			delete activeTokens[token];
	});
}

function putCredential(credentialToken, result) {
	removeExpiredCredentials();
	activeTokens[credentialToken] = {
		'result': result,
		'expires': (+new Date) + (1000 * tokenLife)
	};
}

function hasCredential(credentialToken) {
	removeExpiredCredentials();
	return _.has(activeTokens, credentialToken);
}

function retrieveCredential(credentialToken) {
	return activeTokens[credentialToken].result;
}

function middleware(req, res, next) {
	// Make sure to catch any exceptions because otherwise we'd crash
	// the runner
	try {
		var data = url.parse(req.url, true);

		if (data.pathname !== '/_raven') {
			// not a raven request. pass to next middleware.
			next();
			return;
		}
		
		var response = data.query['WLS-Response'].split("!");
		
		var sig = componentDecode(response.pop());
		var keyId = componentDecode(response.pop());
				
		var status = response[1];
		if (status != '200')
			throw new Meteor.Error("Authentication request failed with code " + parseInt(status));
			
		if (!checkSig(response.join("!"), sig))
			throw new Meteor.Error("Authentication request failed due to invalid signature");
		
		var crsid = componentDecode(response[6]);
		var credentialToken = componentDecode(response[11]);
		
		var result = {
			'serviceData': {
				'id': crsid,
				'email': crsid + '@cam.ac.uk',
			},
			'options': {
				'profile': {
					'name': crsid
				}
			}
		};
		putCredential(credentialToken, result);

		closePopup(res);
	} catch (err) {
		console.log(err);
		res.writeHead(200, {'Content-Type': 'text/plain'});
		res.end('' + err, 'utf-8');
	}
};

Accounts.registerLoginHandler(function (options) {
	if (!options.raven)
		return undefined; // don't handle
		

	check(options.raven, {credentialToken: String});

	if (!hasCredential(options.raven.credentialToken)) {
		throw new Meteor.Error(Accounts.LoginCancelledError.numericError, 'No matching login attempt found, or login token has expired');
	}
	var result = retrieveCredential(options.raven.credentialToken);
	if (result instanceof Error)
		// We tried to login, but there was a fatal error. Report it back
		// to the user.
		throw result;
	else
		return Accounts.updateOrCreateUserFromExternalService('raven', result.serviceData, result.options);
});



function checkSig(data, sig) {
	var key = Assets.getText('private/raven-public-key.crt');

	var verifier = crypto.createVerify('SHA1');
	verifier.update(data);
	return verifier.verify(key, wlsDecode(sig), 'base64');
}

function closePopup(res) {
  res.writeHead(200, {'Content-Type': 'text/html'});
  var content =
        '<html><head><script>window.close()</script></head></html>';
  res.end(content, 'utf-8');
};

Meteor.users._ensureIndex('services.raven.id', {unique: 1, sparse: 1});
Meteor.startup(function () {
	Package['service-configuration'].ServiceConfiguration.configurations.upsert({service: 'raven'}, {service: 'raven'});
});

