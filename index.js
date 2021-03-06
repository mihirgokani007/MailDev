
/**
 * MailDev - index.js
 *
 * Author: Dan Farrelly <daniel.j.farrelly@gmail.com>
 * Licensed under the MIT License.
 */

var program = require('commander');
var async = require('async');
var pkg = require('./package.json');
var web = require('./lib/web');
var mailserver = require('./lib/mailserver');
var logger = require('./lib/logger');
var fs = require('fs');


module.exports = function(config) {

  var version = pkg.version;

  if (!config) {
    // CLI
    config = program
      .version(version)
      .option('-s, --smtp <port>', 'SMTP port to catch emails [1025]', '1025')
      .option('-w, --web <port>', 'Port to run the Web GUI [1080]', '1080')
      .option('--ip <ip address>', 'IP Address to bind SMTP service to', '0.0.0.0')
      .option('--save-to <path>', 'Save all emails to this directory for processing later')
      .option('--outgoing-host <host>', 'SMTP host for outgoing emails')
      .option('--outgoing-port <port>', 'SMTP port for outgoing emails')
      .option('--outgoing-user <user>', 'SMTP user for outgoing emails')
      .option('--outgoing-pass <password>', 'SMTP password for outgoing emails')
      .option('--outgoing-secure', 'Use SMTP SSL for outgoing emails')
      .option('--auto-relay', 'Use auto-relay mode')
      .option('--auto-relay-rules <file>', 'Filter rules for auto relay mode')
      .option('--incoming-user <user>', 'SMTP user for incoming emails')
      .option('--incoming-pass <pass>', 'SMTP password for incoming emails')
      .option('--web-ip <ip address>', 'IP Address to bind HTTP service to, defaults to --ip')
      .option('--web-user <user>', 'HTTP user for GUI')
      .option('--web-pass <password>', 'HTTP password for GUI')
      .option('--web-secure-key <key>', 'Key file to use when HTTPS is enabled for GUI')
      .option('--web-secure-cert <cert>', 'Certificate to use when HTTPS is enabled for GUI')
      .option('--web-secure-ca <ca>', 'Custom CA chain to use when HTTPS is enabled for GUI')
      .option('--base-pathname <path>', 'base path for URLs')
      .option('-o, --open', 'Open the Web GUI after startup')
      .option('-v, --verbose')
      .option('--silent')
      .parse(process.argv);
  }

  if (config.verbose) {
    logger.setLevel(2);
  } else if (config.silent) {
    logger.setLevel(0);
  }

  // Start the Mailserver & Web GUI
  mailserver.create(config.smtp, config.ip, config.incomingUser, config.incomingPass, config.saveTo);

  if (config.outgoingHost ||
      config.outgoingPort ||
      config.outgoingUser ||
      config.outgoingPass ||
      config.outgoingSecure) {

    mailserver.setupOutgoing(
      config.outgoingHost,
      parseInt(config.outgoingPort),
      config.outgoingUser,
      config.outgoingPass,
      config.outgoingSecure
    );
  }

  if (config.autoRelay){
    mailserver.setAutoRelayMode(true, config.autoRelayRules);
  }

  // Default to run on same IP as smtp
  var webIp = config.webIp ? config.webIp : config.ip;

  var httpsOptions;
  if (config.webSecureKey && config.webSecureCert) {
    httpsOptions = {
       key: fs.readFileSync(config.webSecureKey),
       cert: fs.readFileSync(config.webSecureCert)
    };
    if (config.webSecureCa) {
      httpsOptions.ca = fs.readFileSync(config.webSecureCa)
    }
  }

  web.start(config.web, webIp, mailserver, config.webUser, config.webPass, config.basePathname, httpsOptions);

  if (config.open){
    var open = require('open');
    open('http://' + (config.ip === '0.0.0.0' ? 'localhost' : config.ip) + ':' + config.web);
  }

  process.on('SIGTERM', function () {
    async.parallel([
      mailserver.end,
      web.close
    ], function(err, results) {
      logger.info('Shutting down...');
      process.exit(0);
    });
  });

  return mailserver;
};
