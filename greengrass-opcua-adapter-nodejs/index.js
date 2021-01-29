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
const Subscriber = require('subscriber');
const opcua = require('node-opcua');
const IotData = require('aws-greengrass-core-sdk').IotData;

const device = new IotData();

Subscriber.setOPCUA(opcua);
Subscriber.setIoTDevice(device);

const OPCUASubscriber = Subscriber.OPCUASubscriber;

const ConfigAgent = require('./config_agent');

var OPCUASubscriberSet = [];

function dumpServerInfo(obj)
{
    obj.forEach(function(item, index, object) {
        console.log("[%s] item.server.url:" + item.server.url, dumpServerInfo.name);
        console.log("[%s] item.server.name:" + item.server.name, dumpServerInfo.name);
        console.log("[%s] item.connection:" + item.connection, dumpServerInfo.name);
    });
}

function clearArray(obj) {
    while (obj.length) {
        obj.pop();
    }
}

function connectServer(serverConfigs, clientOptions, customConfig)
{
    var i = 0;
    for (i = 0; i < serverConfigs.length; i+=1) {
        if (!serverConfigs[i].connection) {
            let client = new opcua.OPCUAClient(clientOptions);
            let subscriber = new OPCUASubscriber(client, serverConfigs[i].server, serverConfigs[i].subscriptions, customConfig);
            OPCUASubscriberSet.push(subscriber);
            subscriber.connect();
            serverConfigs[i].connection = true;
        }
    }
}

var convertSerConfigToMap = function (arrObj) {

    return arrObj.reduce(function(result, current) {
        var subscriptions = current.subscriptions.reduce(function(map, obj) {
            map[obj.id] = obj.displayName;
            return map;
        }, {});
        result[current.server.name] = result[current.id_0] || {};
        result[current.server.name]["url"] = current.server.url;
        result[current.server.name]["subscription"] = subscriptions;
        return result;
    }, {});
};



var convertOPCUASubscriberSetToMap = function (arrObj) {

    return arrObj.reduce(function(result, current) {
        var subscriptions = current.getNodeConfig().reduce(function(map, obj) {
            map[obj.id] = obj.displayName;
            return map;
        }, {});
        var server = current.getServerConfig();
        result[server.name] = result[current.id_0] || {};
        result[server.name]["url"] = server.url;
        result[server.name]["subscription"] = subscriptions;
        return result;
    }, {});
};

function updateOPCUASubscriberSetStatus()
{
    if (OPCUASubscriberSet.length > 0) {
        let index = 0;
        for (index = 0; index < OPCUASubscriberSet.length; index += 1) {
            if (OPCUASubscriberSet[index]._session &&
                OPCUASubscriberSet[index]._session._closed === true) {
                OPCUASubscriberSet.splice(index, 1);
                index -= 1;
            }
        }
    }
}

function updateConfig()
{
    updateOPCUASubscriberSetStatus();
    ConfigAgent.configInit(ConfigAgent.ReServerConfigs, () => {
        if (ConfigAgent.ReServerConfigs.length > 0) {
            let reConfigServerMap = convertSerConfigToMap(ConfigAgent.ReServerConfigs);
            let OPCUASubscriberSetMap = convertOPCUASubscriberSetToMap(OPCUASubscriberSet);
            // 1. disconnect subscribe which not exist or need modification
            for (let serverName in OPCUASubscriberSetMap) {
                let haveSameSub = false;
                if (serverName in reConfigServerMap &&
                    OPCUASubscriberSetMap[serverName]["url"] === reConfigServerMap[serverName]["url"]) {
                    let reConfigServerSubMap = reConfigServerMap[serverName]["subscription"];
                    let OPCUASubscriberSetSubMap = OPCUASubscriberSetMap[serverName]["subscription"];
                    haveSameSub = Object.keys(reConfigServerSubMap).length == Object.keys(OPCUASubscriberSetSubMap).length;

                    if (haveSameSub) {
                        for (let subs in reConfigServerSubMap) {
                            if (! (subs in OPCUASubscriberSetSubMap)) {
                                haveSameSub = false;
                                break;
                            }
                        }
                    }
                }

                if (!haveSameSub) {
                    // subscriber disconnect and removed from OPCUASubscriberSet
                    let index = 0;
                    for (index = 0; index < OPCUASubscriberSet.length; index += 1) {
                        if (OPCUASubscriberSet[index].getServerConfig().name ===
                            serverName) {
                            OPCUASubscriberSet[index].disconnect();
                            OPCUASubscriberSet.splice(index, 1);
                            index -= 1;
                        }
                    }
                } else {
                    // set connection flag to true to prevent replicate connect in connectServer()
                    ConfigAgent.ReServerConfigs.find(function(item, index, array) {
                        if (item.server.name === serverName) {
                            item.connection = true;
                            return;
                        }
                    });
                }
            }
            // 2. connect to modified server
            connectServer(ConfigAgent.ReServerConfigs, ConfigAgent.clientOptions, ConfigAgent.customerOption);
            ConfigAgent.ServerConfigs = ConfigAgent.ReServerConfigs;
            console.log("+++++++++++++++ dump ConfigAgent.ServerConfigs +++++++++++++++");
            dumpServerInfo(ConfigAgent.ReServerConfigs);
            ConfigAgent.ReServerConfigs = [];
        }
        else
        {
            // there's no any configuration, disconnect all connected device
            // subscriber and clear the OPCUASubscriberSet
            let index = 0;
            for (index = 0; index < OPCUASubscriberSet.length; index += 1) {
                OPCUASubscriberSet[index].disconnect();
            }
            clearArray(OPCUASubscriberSet);
        }
    });
}

// confirm the configuration file path.
ConfigAgent.confirmFilePath();

ConfigAgent.checkFileLoop(()=> updateConfig());

exports.handler = (event, context) => {
    console.log('Not configured to be called');
};
