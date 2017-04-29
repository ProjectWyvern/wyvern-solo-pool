const request = require('request');
const bunyan  = require('bunyan');
const Stratum = require('stratum-pool');
const util    = require('stratum-pool/lib/util.js');

const log = bunyan.createLogger({name: 'wyvern-solo-pool'});

const coin = {
  name: 'Wyvern',
  symbol: 'WYV',
  algorithm: 'nist5'
};

log.info({name: coin.name, symbol: coin.symbol, algorithm: coin.algorithm}, 'Initialized coin');

const rpc = function(url, user, pass, method, params, callback) {
  request(
    {method: 'POST', url: url, auth: {user: user, pass: pass}, body: JSON.stringify({id: 0, method: method, params: params})},
    function(err, resp, body) { 
      if (!err)
        callback(JSON.parse(body).result);
      else
        log.warn({err: err, body: body}, 'Error performing Wyvern RPC call');
    }   
  );  
};

const host = process.env['DAEMON_HOST'];
const user = process.env['DAEMON_USER'];
const pass = process.env['DAEMON_PASS'];
const port = parseInt(process.env['DAEMON_PORT']);

log.info({host: host, port: port}, 'Configured Wyvern daemon');

const wyvRPC = function(method, params, callback) {
  rpc('http://' + host + ':' + port, user, pass, method, params, callback);
};

const diff      = parseFloat(process.env['DEFAULT_DIFF']);
const variance  = parseFloat(process.env['DIFF_VARIANCE']);

log.info({diff: diff, variance: variance}, 'Configured difficulty');

const minerWorker = process.env['MINER_WORKER'];
const minerPass   = process.env['MINER_PASS'];

log.info({minerWorker: minerWorker, minerPass: minerPass}, 'Configured miner authorization');

const poolPort  = parseInt(process.env['POOL_PORT']);
var ports = {};
ports[poolPort] = {diff: diff, varDiff: {minDiff: diff / variance, maxDiff: diff * variance, targetTime: 15, retargetTime: 90, variancePercent: 30}};

wyvRPC('getnewaddress', [], function(addr) {

  log.info({addr: addr}, 'Generated initial coinbase address');

  const pool = Stratum.createPool({
    coin: coin,
    address: addr,
    rewardRecipients: {},
    blockRefreshInterval: 100,
    jobRebroadcastTimeout: 30,
    connectionTimeout: 3600,
    emitInvalidBlockHashes: false,
    tcpProxyProtocol: false,
    banning: {enabled: false},
    ports: ports,
    daemons: [{host: host, port: port, user: user, password: pass}],
    p2p: {
      enabled: false
    }
  }, function(ip, port, worker, pass, callback) {
    if (worker === minerWorker && pass === minerPass) {
      log.info({worker: worker, pass: pass, ip: ip, port: port}, 'Authorized worker');
      callback({error: null, authorized: true, disconnect: false});
    } else {
      log.warn({worker: worker, pass: pass, ip: ip, port: port}, 'Rejecting worker connection with invalid credentials');
      callback({error: 'invalid-credentials', authorized: false, disconnect: true});
    }
  });

  var shares = [];
  var clients = 0;

  var checkHashrate = function() {
    var difficulty = 0;
    var now = Date.now() / 1000;
    shares = shares.filter(function(s) { return (now - s.timestamp) < 600; });
    for (var i = 0; i < shares.length; i++)
      difficulty += shares[i].share.difficulty;
    var hashrate = difficulty * Math.pow(2, 32);
    hashrate /= 600;
    log.info({clients: clients, shares600s: shares.length, hashrate600s: (hashrate / 1e9) + ' GH/s'}, 'Current pool statistics');
    setTimeout(checkHashrate, 10 * 1000);
  }

  checkHashrate();

  pool.on('started', function () {
    pool.stratumServer.on('client.connected', function() {
      clients += 1;
    });

    pool.stratumServer.on('client.disconnected', function() {
      clients -= 1;
    });
  });

  const setAddress = function() {
    wyvRPC('getnewaddress', [], function(addr) {
      wyvRPC('validateaddress', [addr], function(res) {
        pool.options.poolAddressScript = util.pubkeyToScript(res.pubkey);
        log.info({addr: addr}, 'Set new coinbase address');
      });
    });   
  };

  pool.on('share', function(isValidShare, isValidBlock, data) {
    if (isValidShare) {
      shares.push({share: data, timestamp: Date.now() / 1000});
      log.info({ip: data.ip, worker: data.worker, shareDiff: data.shareDiff}, 'Valid share submission');
    } else {
      log.warn({ip: data.ip, worker: data.worker, shareDiff: data.shareDiff}, 'Invalid share submission');
    }
    if (isValidBlock) {
      log.warn(data, 'Submitted valid block to daemon instance');
      setAddress();
    }
  });

  pool.on('log', function(severity, logKey, logText) {
    if (severity === 'special') {
      log.info(logKey);
    }
  });

  log.info({port: poolPort}, 'Starting Stratum poolserver');

  pool.start();

});
