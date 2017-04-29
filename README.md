Wyvern Solo Pool
================

Simple, fast Stratum-compatible Wyvern pool for solo mining.

Please note that this is a Stratum mining pool intended for *solo* usage - shares are not tracked, and there is no payment handling. You will need to run a dedicated instance of the Wyvern daemon.

Features
--------

- Efficient, configurable variable-difficulty Stratum implementation using [node-stratum-pool](https://github.com/zone117x/node-stratum-pool)
- Automatic coinbase address switching (sets a new address for each block mined)
- Worker connect/disconnect, share submittal, block submittal, mean ten-minute hashrate logging

Usage Example
-------------

`docker run -d --net=host -e POOL_PORT="12121" -e MINER_WORKER="worker" -e MINER_PASS="pass" -e DAEMON_HOST="127.0.0.1" -e DAEMON_USER="user" -e DAEMON_PASS="pass" -e DAEMON_PORT="44455" -e DEFAULT_DIFF="1.0" -e DIFF_VARIANCE="10.0" protinam/wyvern-solo-pool`

Miner worker and miner pass are the credentials used for Stratum clients. Pool port is the external port which the pool daemon will bind to. You'll need to replace the four daemon environment variables with the correct values for your Wyvern daemon. Default difficulty and difficulty variance, respectively, control what share difficulty is set initially on a miner connection, and the maximum factor that difficulty can change by.
