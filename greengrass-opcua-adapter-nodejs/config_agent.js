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
//requiring path and fs modules
const path = require('path');
const fs = require('fs');
const jsonFile = require('jsonfile');
const serverConfigfileName = 'published_nodes.json';
const clientConfigfileName = 'client_config.json';
const certConfigName = 'cert_config.json';
const systemStatus = 'system_status.txt';
const folder = '/etc/greengrass/opcua-adapter/config';


var LastModifiedtime = "";

var ServerConfigs = [];

var ReServerConfigs = [];

var clientOptions = {
    keepSessionAlive: true,
    connectionStrategy: {
        maxRetry: 100000,
        initialDelay: 2000,
        maxDelay: 10 * 1000
    },
    checkServerConfigInterval: 1000
};

var certConfig = {
    certPath: ""
};

var timeout = 0;

function isEmptyOrWhitespace(value) {
    return (!value || !value.trim());
}

function isEmpty(value) {
    return (!value);
}

/**
 * @function configInit
 * @description This function is used to load regarding json files to configuration variable.
 * @param serverConfigs - opcua server configuration.
 * @param callback - this will be called after finishing loading json configuration,
 *                   the user can take use of loaded configuration to handle connection.
 */

function configInit(serverConfigs, callback) {
    jsonFile.readFile(`${folder}/${clientConfigfileName}`, function (err, configList) {
        if (err) {
            throw err;
        }
        for (let i = 0; i < configList.length; i += 1) {

            if (isEmptyOrWhitespace(configList[i].keepSessionAlive)) {
                throw new Error("configList[%d].keepSessionAlive is empty or whitespace", i);
            }

            if (!Number.isInteger(configList[i].connectionStrategy.maxRetry)) {
                throw new Error("configList[%d].connectionStrategy.maxRetry is not a number", i);
            }

            if (!Number.isInteger(configList[i].connectionStrategy.initialDelay)) {
                throw new Error("invalid .connectionStrategy.initialDelay is not a number");
            }

            if (!Number.isInteger(configList[i].connectionStrategy.maxDelay)) {
                throw new Error("connectionStrategy.maxDelay is not a number");
            }

            if (!Number.isInteger(configList[i].checkServerConfigInterval)) {
                throw new Error("connectionStrategy.maxDelay is not a number");
            }

            clientOptions.keepSessionAlive = configList[i].keepSessionAlive;
            clientOptions.connectionStrategy.maxRetry = configList[i].connectionStrategy.maxRetry;
            clientOptions.connectionStrategy.initialDelay = configList[i].connectionStrategy.initialDelay;
            clientOptions.connectionStrategy.maxDelay = configList[i].connectionStrategy.maxDelay;
            clientOptions.checkServerConfigInterval = configList[i].checkServerConfigInterval;

            console.log("[%s] configList[%d].keepSessionAlive: " + configList[i].keepSessionAlive, configInit.name, i);
            console.log("[%s] configList[%d].connectionStrategy.maxRetry: " + configList[i].connectionStrategy.maxRetry, configInit.name, i);
            console.log("[%s] configList[%d].connectionStrategy.initialDelay: " + configList[i].connectionStrategy.initialDelay, configInit.name, i);
            console.log("[%s] configList[%d].connectionStrategy.maxDelay: " + configList[i].connectionStrategy.maxDelay, configInit.name, i);
            console.log("[%s] configList[%d].checkServerConfigInterval: " + configList[i].checkServerConfigInterval, configInit.name, i);
        }
    });

    jsonFile.readFile(`${folder}/${certConfigName}`, function (err, configList) {
        if (err) {
            throw err;
        }

        if (isEmptyOrWhitespace(configList[0].CertPath)) {
            throw new Error("configList[0].CertPath is empty or whitespace");
        }

        certConfig.CertPath = configList[0].CertPath;
        console.log("[%s] configList[0].CertPath: " + configList[0].CertPath, configInit.name);

    });

    jsonFile.readFile(`${folder}/${serverConfigfileName}`, function (err, configList) {
        if (err) {
            throw err;
        }
        var stats = fs.statSync(`${folder}/${serverConfigfileName}`);
        var serverFileLastModifyTime = stats.mtime;

        configList.forEach((config)=> {
            if (isEmptyOrWhitespace(config.EndpointName)) {
                console.log("invalid EndpointName");
                return;
            }

            if (isEmptyOrWhitespace(config.EndpointUrl)) {
                console.log("invalid EndpointUrl");
                return;
            }

            if (config.OpcNodes.length <= 0) {
                console.log("No OpcNodes!");
                return;
            }
            var serverConfig = {
                server: {
                    name: "",
                    url: "",
                    certExist:0
                },
                userIdentity: null,
                subscriptions: [],
                connection: false
            };
            console.log("[%s] EndpointName: " + config.EndpointName, configInit.name);
            console.log("[%s] EndpointUrl: " + config.EndpointUrl, configInit.name);

            for (let j = 0; j < config.OpcNodes.length; j += 1) {
                serverConfig.subscriptions.push(config.OpcNodes[j]);
                console.log("[%s] serverConfig.subscriptions.Id: " + serverConfig.subscriptions[j].Id, configInit.name);
                console.log("[%s] serverConfig.subscriptions.DisplayName: " + serverConfig.subscriptions[j].DisplayName, configInit.name);
            }
            console.log("[%s] serverConfig.subscriptions node length:" + serverConfig.subscriptions.length, configInit.name);
            serverConfig.server.url = config.EndpointUrl;
            serverConfig.server.name = config.EndpointName;

            // set default is certificate mode if user didn't set CertExist in published_nodes.json
            if (config.CertExist === undefined || config.CertExist === null ) {
                serverConfig.server.certExist = 1;
            } else {
                serverConfig.server.certExist = config.CertExist;
            }
            console.log("[%s] serverConfig.server.certExist: " + serverConfig.server.certExist, configInit.name);
            serverConfig.server.userIdentity = config.userIdentity;
            serverConfigs.push(serverConfig);
            LastModifiedtime = serverFileLastModifyTime;
        });
        callback();
    });
}

function datesEqual(a, b) {
    return !(a > b || b > a);
}


/**
 * @function reportSystemStatus
 * @description This function is used to report the system status by writing time second into a file.
 */
function reportSystemStatus() {
    // overwrite system time to update system status
    var dateObject = new Date();
    var seconds = dateObject.getSeconds();
    fs.writeFile(`${folder}/${systemStatus}`, seconds, function (error) {
        if (error) {
            console.log("Failed to write system time to " + folder + ": " + error);
        } else {
            console.log("System time written in " + folder + "successfully");
        }
    });
}

var compareWithTrustCert = function (serverCert) {
    // read file in the same folder
    var files = fs.readdirSync(certConfig.CertPath);
    for (let file of files) {
        let contents = fs.readFileSync(`${certConfig.CertPath}/${file}`);
        if (contents.length === serverCert.length) {
            if (contents.equals(serverCert)) {
                 return true;
            }
        }
    }
    return false;
};

function checkFileLoop(callback) {
    var obj = setInterval(()=> {
        clearInterval(obj);

        // check server file config file
        var stats = fs.statSync(`${folder}/${serverConfigfileName}`);
        var mtime = stats.mtime;
        //update process running status
        reportSystemStatus();

        // File modified due to different date
        if (!datesEqual(mtime, LastModifiedtime)) {
            LastModifiedtime = mtime;
            callback();
        }

        if (clientOptions.checkServerConfigInterval > 0) {
            timeout = clientOptions.checkServerConfigInterval;
        }
        checkFileLoop(callback);
    }, timeout);
}

module.exports.configInit = configInit;
module.exports.ServerConfigs = ServerConfigs;
module.exports.ReServerConfigs = ReServerConfigs;
module.exports.clientOptions = clientOptions;
module.exports.checkFileLoop = checkFileLoop;
module.exports.compareWithTrustCert = compareWithTrustCert;

