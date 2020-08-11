/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: MIT-0
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy of this
 * software and associated documentation files (the "Software"), to deal in the Software
 * without restriction, including without limitation the rights to use, copy, modify,
 * merge, publish, distribute, sublicense, and/or sell copies of the Software, and to
 * permit persons to whom the Software is furnished to do so.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED,
 * INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A
 * PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT
 * HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION
 * OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE
 * SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
 */

'use strict';

require('requirish')._(module);
const util = require('util');
const EventEmitter = require('events');
const ConfigAgent = require('./config_agent');

let Opcua;
let IoTDevice;

class OPCUASubscriber {
    constructor(client, serverConfig, monitoredItemsConfig) {
        this._client = client;
        this._serverConfig = serverConfig;
        this._monitoredItemsConfig = monitoredItemsConfig;
        const self = this;
        this.on('connect', () => {
            self.createSession();
        });
        this.on('session_create', () => {
            self.createSubscription();
        });
        this.on('subscribe', () => {
            self.monitorNodes();
        });

        // This is reconnection mechanism inside the OPCUAClient, and
        // There's already a default handle function in OPCUAClient
        // class as a prototype, what I modify here is to override it to
        // fit our architecture.
        client._on_connection_reestablished  = function (callback) {
            console.log(" client._on_connection_reestablished".bgWhite.red);
            self.emit('connect');
        }
    }

    connect() {
        const self = this;
        self._client.connect(self._serverConfig.url, (connectError) => {
            if (connectError) {
                console.log('Got an error connecting to ', self._serverConfig.url, ' Err: ', connectError);
                return;
            }
            self.emit('connect');
        });
    }

    disconnect() {
        const self = this;

        self._client.disconnect(function (err) {
            if (err) {
                console.log("OPCUAClient#withClientSession: client disconnect failed ?");
                console.log('Got an error disconnecting from ', self._serverConfig.url, ' Err: ', err);
            } else {
                self.emit('disconnect');
            }
        });
    }


    createSession() {
        var userIdentity = null;
        const self = this;
        console.log("createSession: config.userIdentity: " + self._serverConfig.userIdentity);
        if (self._serverConfig.userIdentity) {
            console.log('self._serverConfig.userIdentity.userName:' + self._serverConfig.userIdentity.userName);
            console.log('self._serverConfig.userIdentity.password:' + self._serverConfig.userIdentity.password);
            if (self._serverConfig.userIdentity.userName &&
                self._serverConfig.userIdentity.password) {
                userIdentity = self._serverConfig.userIdentity;
            }
        } else {
            console.log('self._serverConfig.userIdentity not exist');
        }

        self._client.createSession(userIdentity, (createSessionError, session) => {
            if (!createSessionError) {
                self._session = session;
                console.log('Session created');
                console.log('SessionId: ', session.sessionId.toString());
                console.log('self._serverConfig.certExist: ', self._serverConfig.certExist);

                // feature to support non-certificate OPCUA Server
                if (self._serverConfig.certExist === 0) {
                    self.emit('session_create');
                } else {
                    var result = ConfigAgent.compareWithTrustCert(session.serverCertificate);
                    console.log("cert compare result: " + result);

                    if (result === false) {
                        createSessionError = new Error("Server certificate not in our trust list ");
                    } else {
                        self.emit('session_create');
                    }
                }
            }

            if (createSessionError) {
                self._client.disconnect(function (err) {
                    if (err) {
                        console.log("OPCUAClient#withClientSession: client disconnect failed ?");
                        console.log('Got an error disconnecting from ', self._serverConfig.url, ' Err: ', err);
                    } else {
                        self.emit('disconnect');
                    }
                });
                console.log('Err: ', createSessionError);
            }
        });
    }

    createSubscription() {
        const parameters = {
            requestedPublishingInterval: 100,
            requestedLifetimeCount: 1000,
            requestedMaxKeepAliveCount: 12,
            maxNotificationsPerPublish: 10,
            publishingEnabled: true,
            priority: 10,
        };

        const self = this;
        this._subscription = new Opcua.ClientSubscription(this._session, parameters);
        this._subscription.on('started', () => {
            console.log('started subscription :', this._subscription.subscriptionId);
            self.emit('subscribe');
        }).on('internal_error', (err) => {
            console.log(' received internal error', err.message);
        }).on('status_changed', (err, v) => {
            console.log('err=', err, ' Value: ', v);
        });
    }

    monitorNodes() {
        const self = this;
        self._monitoredItemsConfig.forEach((monitoredNode) => {
            console.log('monitoring node id = ', monitoredNode.Id);
            const monitoredItem = this._subscription.monitor(
                {
                    nodeId: monitoredNode.Id,
                    attributeId: Opcua.AttributeIds.Value,
                },
                {
                    samplingInterval: 250,
                    queueSize: 10000,
                    discardOldest: true,
                },
                Opcua.read_service.TimestampsToReturn.Both
            );
            monitoredItem.on('initialized', () => {
                console.log('monitoredItem initialized');
            });
            monitoredItem.on('changed', (dataValue) => {
                const monitoredNodeName = monitoredNode.DisplayName;
                const serverName = self._serverConfig.name;
                const time = dataValue.sourceTimestamp;
                const nodeId = monitoredItem.itemToMonitor.nodeId.toString();
                const payload = {
                    id: nodeId,
                    displayName: monitoredNodeName,
                    timestamp: time,
                    value: dataValue.value,
                };
                const awsServerName = serverName.replace(/\#|\?|\+/g,'');
                const awsNodeName = monitoredNodeName.replace(/\#|\?|\+/g,'');
                const topic = `opcua/${awsServerName}/node/${awsNodeName}`;
                const payloadStr = JSON.stringify(payload);
                IoTDevice.publish(
                    {
                        topic: topic,
                        payload: payloadStr,
                    },
                    (err) => {
                        if (err) {
                           console.log(`Failed to publish ${payloadStr} on ${topic}. Got the following error: ${err}`);
                        }
                    });
            });

            monitoredItem.on('err', (errorMessage) => {
                console.log(monitoredItem.itemToMonitor.nodeId.toString(), ' ERROR', errorMessage);
            });
        });
    }
    getServerConfig() {
        return this._serverConfig;
    }

    getNodeConfig() {
        return this._monitoredItemsConfig;
    }
}

util.inherits(OPCUASubscriber, EventEmitter);

module.exports = {
    OPCUASubscriber: OPCUASubscriber,
    setOPCUA: (opcua) => {
        Opcua = opcua;
    },
    setIoTDevice: (device) => {
        IoTDevice = device;
    },
};

