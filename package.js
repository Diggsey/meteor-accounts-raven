Package.describe({
  summary: "Login service for Cambridge University Raven accounts"
});

Package.on_use(function(api) {
  api.use('accounts-base', ['client', 'server']);
  // Export Accounts (etc) to packages using this one.
  api.imply('accounts-base', ['client', 'server']);
  api.use('accounts-oauth', ['client', 'server']);

  api.use('webapp', 'server');

  api.add_files('lib/raven.css', 'client');

  api.add_files('lib/raven_server.js', 'server');
  api.add_files('lib/raven_client.js', 'client');

  api.add_files('private/raven-public-key', 'server', {isAsset: true});
  api.add_files('private/raven-public-key.crt', 'server', {isAsset: true});
});