'use strict';

// NPM
const WebSocketServer = require('ws').Server;

// GENERAL NOTES:
// Connections are stored in this.wss.clients
// ws.upgradeReq.url === CLIENT "ROOM"

// Setup
let connectedPeers = [];
let listeners = {
    connection: () => {},
    disconnection: () => {}
};
let wss;

// More aggressive at start for testing purposes
const KEEP_ALIVE_INTERVAL = 1000 * 90 //90 seconds
const TTL = 3 // 3 sets of pings and no pong, you dead

module.exports = {
    init: function(opts) {
        let serverInit = typeof(opts) === "number"
            ? { port: opts }
            : { server: opts }
        wss = new WebSocketServer(serverInit);
        console.log("Roster running");
        registerEventHandlers();
        setInterval(startKeepAliveChecks, KEEP_ALIVE_INTERVAL)
    },
    on: function (evt, callback) {
        listeners[evt] = callback
    }
}

function startKeepAliveChecks() {
    wss.clients.forEach((client) => {
        let clientId = client.upgradeReq.headers['sec-websocket-key'];
        canSend(client) && client.send(JSON.stringify({type: "ping"}))
        let peerInd = connectedPeers.findIndex((masterPeer) => masterPeer.wsId === clientId)
        let peer = connectedPeers[peerInd];
        ++peer.pings && peer.pings > TTL && connectedPeers.splice(peerInd, 1)
    })
}

function stilAlive(chatroom, evt, ws) {
    let wsId = ws.upgradeReq.headers['sec-websocket-key'];
    let peerInd = connectedPeers.findIndex((masterPeer) => masterPeer.wsId === wsId)
    connectedPeers[peerInd] && (connectedPeers[peerInd].pings = 0);
    // Inflates logs, dont need for now
    // console.log(wsId+" sent pong");
}

function registerEventHandlers() {
    wss.on("connection", (ws) => {
        let wsId = ws.upgradeReq.headers['sec-websocket-key'];
        ws.send(JSON.stringify({type: "id", msg: wsId}))
        connectedPeers.push({wsId: wsId, pings: 0});
        console.log("Client Connected");

        ws.on('message', (evt) => {
            evt = JSON.parse(evt);
            let chatroom = ws.upgradeReq.url
            evt.type === "pong" && stilAlive(chatroom, evt, ws);
            evt.type === "connection" && registerConnection(chatroom, evt, ws);
        })
        ws.on("close", (evt) => {
            removeConnection(wsId);
            let peerInd = connectedPeers.findIndex((masterPeer) => masterPeer.wsId === wsId)
            peerInd > -1 && connectedPeers.splice(peerInd, 1);
            console.log("Client closed. Clients in room after close evt: ", connectedPeers.length);
        })
    });
}

function registerConnection(chatroom, evt, ws) {
    assignName(evt, ws);
    let count = getCount(evt, ws)
    let info = {
        name: evt.name || "",
        port: evt.port || "",
        env: evt.env || "",
        isInternal: evt.isInternal || "",
        serverCount: count
    }
    listeners["connection"](info)
}

function removeConnection(wsId) {
    let peer = connectedPeers.filter((peer) => peer.wsId === wsId)
    peer[0] && listeners["disconnection"](peer[0].name, peer[0].env)
}

function assignName(evt, ws) {
    let wsId = ws.upgradeReq.headers['sec-websocket-key'];
    connectedPeers.forEach((peer) => {
        if(peer.wsId === wsId) {
            peer.name = evt.name;
            peer.env = evt.env
        }
    })
}

function getCount(evt, ws) {
    return connectedPeers.filter((peer) =>  {
        return peer.name === evt.name && peer.env === evt.env
    }).length
}

function canSend(ws) { return ws.readyState === 1 }
