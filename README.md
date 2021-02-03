# Use Greengrass OPC\-UA to Communicate with Multiple Industrial Equipment<a name="opcua"></a>

Greengrass supports OPC\-UA, an information exchange standard for industrial communication\. OPC\-UA allows you to ingest and process messages from industrial equipment and deliver them to devices in your Greengrass group or to the cloud based on rules you define\.

The Greengrass implementation of OPC\-UA supports certificate\-based authentication\. It is based on an open source implementation, and is fully customizable\. You can also bring your own implementation of OPC\-UA, and implement your own support for other custom, legacy, and proprietary messaging protocols\.

In this section we will cover the following steps: 
+ Connect to an existing multiple OPC\-UA servers\.
+ Monitor multiple existing OPC\-UA nodes within that server\.
+ Get called back when the monitored node's value changes\.


## Architectural Overview<a name="opcua-architecture"></a>

Greengrass implements OPC\-UA as a Lambda function in NodeJS\. Since Lambda functions running on Greengrass cores have access to network resources, you can create Lambda functions that proxy information from your existing OPC\-UA servers over TCP to other functions or services in your Greengrass group\.

Under this architecture, we provide the following additional features for customer to use:
+ [published_nodes\.json](./greengrass-opcua-adapter-nodejs/config/published_nodes.json), used to configured how many OPC-UA nodes in dedicated OPC-UA server need to be monitored\.
+ [cert_config\.json](./greengrass-opcua-adapter-nodejs/config/cert_config.json), used to configure the path of server certificates\.
+ [client_config\.json](./greengrass-opcua-adapter-nodejs/config/client_config.json), used to configure some client options and time interval to check publishednodes.json modification\.
+ [system_status.txt](./greengrass-opcua-adapter-nodejs/config/system_status.txt), used to check if the system is alive or not\.

![\[Greengrass OPCUA Architecture.\]](./greengrass-opcua-adapter-nodejs/pics/OPCUA_arch.png)

You can configure Greengrass to have a long\-lived connection to your OPC\-UA server\(s\), and, using OPC\-UA Subscriptions, you can have your OPCUA\_Adapter Lambda function monitor changes to pre\-defined nodes\. Any change to those nodes triggers a Publish event from the OPC\-UA server, which will be received by your Lambda function, and republished into predefined topic names\.

## Set Up a Test OPC\-UA Server<a name="opcua-test-server"></a>

Use the following commands to set up a test OPC\-UA server\. Or, if you already have an OPC\-UA server you'd like to use instead, you may skip this step\.

```console
git clone git://github.com/node-opcua/node-opcua.git
cd node-opcua
git checkout v0.0.65
npm install
node bin/simple_server
```

The server produces the following output:

```console
[ec2-user@<your_instance_id> node-opcua]$ node bin/simple_server
  server PID          : 28585

registering server to :opc.tcp://<your_instance_id>4840/UADiscovery
err Cannot find module 'usage'
skipping installation of cpu_usage and memory_usage nodes
  server on port      : 26543
  endpointUrl         : opc.tcp://<your_instance_id>us-west-2.compute.internal:26543
  serverInfo          :
      applicationUri                  : urn:54f7890cca4c49a1:NodeOPCUA-Server
      productUri                      : NodeOPCUA-Server
      applicationName                 : locale=en text=NodeOPCUA
      applicationType                 : SERVER
      gatewayServerUri                : null
      discoveryProfileUri             : null
      discoveryUrls                   : 
      productName                     : NODEOPCUA-SERVER
      buildInfo                       :
      productUri                      : NodeOPCUA-Server
      manufacturerName                : Node-OPCUA : MIT Licence ( see http://node-opcua.github.io/)
      productName                     : NODEOPCUA-SERVER
      softwareVersion                 : 0.0.65
      buildNumber                     : 1234
      buildDate                       : Thu Aug 03 2017 00:13:50 GMT+0000 (UTC)

  server now waiting for connections. CTRL+C to stop
```
You could setup many OPC\-UA servers concurrently.
## Make sure your Greengrass Group is ready<a name="opcua-group"></a>
+ Create a Greengrass group \(find more details in [Configure AWS IoT Greengrass on AWS IoT](https://docs.aws.amazon.com/greengrass/latest/developerguide/gg-config.html)\.\) 
+ Set up a Greengrass Core on one of the supported platforms \(Raspberry\-pi for [example](https://docs.aws.amazon.com/greengrass/latest/developerguide/setup-filter.rpi.html)\) 
+ [Set up](https://github.com/aws/aws-greengrass-core-sdk-js/) your Greengrass Core to be able to run nodejs12\.x Lambda functions.
+ Set up [local resource](https://docs.aws.amazon.com/greengrass/latest/developerguide/access-local-resources.html) to access the configurable json file, ```/etc/greengrass/opcua-adapter/config/system_status.txt```, for the additional features as described in the [Architecture section](#opcua-architecture).
![\[Greengrass Lambda LRA.\]](./greengrass-opcua-adapter-nodejs/pics/OPCUA_Lambda_LRA.png)

## Use Greengrass OPC\-UA to Interact with your OPC\-UA Server<a name="opcua-interact"></a>

1. Prepare your Lambda function and relocate the config foler.

   + Get the code for an OPC\-UA adapter Lambda function from GitHub: 

      ``` nodejs
      git clone https://github.com/aws-samples/aws-iot-greengrass-opcua-adapter.git
      cd greengrass-opcua-adapter-nodejs
      npm install
      ```
   + Fix the issue happened due to openssl while npm install
      + The error log would looks like the following:
      ```
      reading configuration
      =====================

      Creating default g_config file  /Your-Path/aws-iot-greengrass-opcua-adapter/greengrass-opcua-adapter-nodejs/node_modules/node-opcua/certificates/config.js
      configuration =
         subject                        : /C=FR/ST=IDF/L=Paris/O=NodeOPCUA/CN=NodeOPCUA-TEST
         validity                       : 5475
         keySize                        : 2048
         certificateDir                 : /Your-Path/aws-iot-greengrass-opcua-adapter/greengrass-opcua-adapter-nodejs/node_modules/node-opcua/certificates
         CAFolder                       : /Your-Path/aws-iot-greengrass-opcua-adapter/greengrass-opcua-adapter-nodejs/node_modules/node-opcua/certificates/CA
         PKIFolder                      : /Your-Path/aws-iot-greengrass-opcua-adapter/greengrass-opcua-adapter-nodejs/node_modules/node-opcua/certificates/PKI
         altNames                       :
         dns                            : f8ffc267b5de.ant.amazon.com
         ip                             :
      OpenSSL version :  OpenSSL 1.1.1g  21 Apr 2020
      ERROR  Command failed: "openssl" genrsa  -out  private/cakey.pem -rand random.rnd 2048
      Can't load random.rnd into RNG
      4406738368:error:2406F079:random number generator:RAND_load_file:Cannot open file:crypto/rand/randfile.c:98:Filename=random.rnd

      Command failed: "openssl" genrsa  -out  private/cakey.pem -rand random.rnd 2048
      Can't load random.rnd into RNG
      4406738368:error:2406F079:random number generator:RAND_load_file:Cannot open file:crypto/rand/randfile.c:98:Filename=random.rnd

      done ... (0)
      ```
      + Fix the error by the patch.
      ```
      git apply patch/Fix-the-npm-install-issue-due-to-openssl.patch
      ```


   + Patch the factories.js
      ``` nodejs
      git apply patch/factories.patch
      ```
   + Relocate the folder `greengrass-opcua-adapter-nodejs/config` to environment variable `AWS_LAMBDA_OPCUA_ADAPTER_CONFIG_FILE_PATH` defined in [Configure Lambda section](#opcua-configure-lambda) or default external path `/etc/greengrass/opcua-adapter/config`.
   + Download [AWS IoT Greengrass Core SDK Software For Nodejs](https://github.com/aws/aws-greengrass-core-sdk-js/)\. and copy aws-greengrass-core-sdk folder into node_modules folder.

      ```console
      # copy aws-greengrass-core-sdk to node_modules
      git clone https://github.com/aws/aws-greengrass-core-sdk-js.git
      cd aws-greengrass-core-sdk-js/
      cp -fr aws-greengrass-core-sdk aws-iot-greengrass-opcua-adapter/greengrass-opcua-adapter-nodejs/node_modules/
      ```

   **Note:**
   + The relocated path must also defined in Lambda configuration in IoT Core console, or the Lambda function wouldn't find the path or have no access right to this path\!
   + There's a future work here which would make this path adjustable\!

2. Configure the server and monitored nodes

   Modify the field `endpointUrl` in the file `published_nodes.json` in config folder which contain the server IP and Port that you want to connect to, as well as the node Ids you would like to monitor\. Here's the example:

   ```json
   {
      "serInfo": [
         {
            "endpointName": "UNO-1372G",
            "endpointUrl": "opc.tcp://localhost:26543",
            "certExist": false,
            "userIdentity": {
               "userName": "",
               "password": ""
            },
            "OpcNodes": [
               {
                  "Id": "ns=1;s=Temperature",
                  "DisplayName": "M140001"
               },
               {
                  "Id": "ns=1;s=FanSpeed",
                  "DisplayName": "M140002"
               },
               {
                  "Id": "ns=1;s=PumpSpeed",
                  "DisplayName": "M140003"
               }
            ]
         }
      ]
   }
   ```

   In this case, we are connecting to an OPC\-UA server running on the same host as our Greengrass Core, on port 26543, and monitoring multiple nodes that has an OPC\-UA Id `'ns=1;s=Temperature'`, `'ns=1;s=FanSpeed'`, and `'ns=1;s=PumpSpeed'`\.

   Besides, There are two additional configuration for OPC-UA Server:
   + certExist: This is a configuration that support certificate validation or not. The OPC-UA adapter will not validtate the OPC-UA server's certificate if this flag set to ```false```, otherwise it will go to check the certificate from the OPC-UA server.
   + userIdentity: This is a configuration to support user identity mechanism from the OPC-UA server. Please fill in the userName and password recognized between the OPC-UA adapter and the OPC-UA server.
   ```json
   "userIdentity":
    {
      "userName": "user1",
      "password": "password1"
    }
   ```
   **Note:**
   + For the node information output from `Advantech Edgelink`, we provide an node converter tool to convert it to `published_nodes.json`, and the following is the example:
      + [sample.csv](./greengrass-opcua-adapter-nodejs/tool/sample.csv) : The node information file generated by Advantech Edgelink.
      + [nodeFileParser.py](./greengrass-opcua-adapter-nodejs/tool/nodeFileParser.py) : The tool to convert the node information file into published_nodes.json.
      + Commands:
        ```
        python3 nodeFileParser.py --inputFile ./sample.csv --serverName UNO-1372G --endpointURL opc.tcp://localhost:26543 --userName testName --password testPassword --userIdentity --certExist
        ```
      + Please take use of help command `python3 nodeFileParser.py -h` for more detail.

3. Configure to authenticate trusted server

   Modify the field `certPath` in cert_config\.json, which is used to tell OPC\-UA client the received OPC\-UA server certificate in Certificate List is matched or not:

    ```json
     {
        "certPath": "Directory"
     }
    ```
    Once there's no any certificate matched in the `certPath`, then the OPC\-UA client wouldn't go on the communication with the OPC\-UA server.

4. Configure [client_config.json](./greengrass-opcua-adapter-nodejs/config/client_config.json) file:
   - `checkServerConfigInterval` : polling time of Lambda.
      - Modify the field `checkServerConfigInterval` to adjust the polling interval in mini second of Lambda reading json file.
   - `reportStatus`: Report system status.
      - Used to write counter into a file to let any other cooperative process aware this lambda still works.
   - `reportTolerance`: Counters to access file to report status.
      - The access right to the file to report status might not correct, use this configuration to prevent system warnings.
   - `customUploadDataStrategy`: The mechanism to keep the received data locally, then it will send them to AWS IoT Core in designated period defined in field `pollingInSecond`.
      - `enableStrategy`: The field used to decide to enable the mechanism or not.
      - `pollingInSecond`: The designated period to send the retained data out to AWS IoT Core.
      - **Note:** This mechanism only keep the latest data for the same node.
    ```json
    {
      "keepSessionAlive": true,
      "connectionStrategy": {
         "maxRetry": 100000,
         "initialDelay": 2000,
         "maxDelay": 10000
      },
      "checkServerConfigInterval": 1000,
      "reportStatus": false,
      "reportTolerance": 5,
      "customUploadDataStrategy": {
         "enableStrategy": true,
         "pollingInSecond": 10
      }
   }
    ```

5. Upload your Lambda

   Create a Greengrass Lambda function\. You can find more details on how to do that in [Configure the Lambda Function for AWS IoT Greengrass](https://docs.aws.amazon.com/greengrass/latest/developerguide/config-lambda.htmlconfig-lambda.md)\. In a nutshell, create a Lambda function code archive by doing the following:

   ```console
   # Archive the whole directory as a zip file under 
   # the folder aws-iot-greengrass-opcua-adapter/greengrass-opcua-adapter-nodejs
   # ├── Directory
   # ├── config
   # ├── config_agent.js
   # ├── index.js
   # ├── node_modules
   # ├── package.json
   # ├── patch
   # ├── pics
   # ├── subscriber.js
   # └── tool
   zip -r opcuaLambda.zip * -x \*.git\*
   ```

   Add this Lambda to your Greengrass Group\. Details are, again, in: [Configure the Lambda Function for AWS IoT Greengrass](https://docs.aws.amazon.com/greengrass/latest/developerguide/config-lambda.html)\.

6. Configure and Deploy the Lambda function to your Greengrass Group<a name="opcua-configure-lambda"></a>

   After creating your AWS Lambda function, you add it to your Greengrass Group\. Follow the instructions in same section as above\.
   + Make sure to specify the Lambda function as Long\-Running\.
   ![\[Greengrass OPCUA Lambda Long-Run.\]](./greengrass-opcua-adapter-nodejs/pics/OPCUA_Lambda_configuration_long_run.png)
   + Give it at least 64MB of memory size\.
   ![\[Greengrass OPCUA Lambda Memory.\]](./greengrass-opcua-adapter-nodejs/pics/OPCUA_Lambda_configuration_memory.png)
   + Configure the environment variable `AWS_LAMBDA_OPCUA_ADAPTER_CONFIG_FILE_PATH` for configurable json file in Group-specific Lambda configuration.
   ![\[Greengrass OPCUA configure environment variable.\]](./greengrass-opcua-adapter-nodejs/pics/OPCUA_Lambda_configuration_env_var.png)

   You can now create a deployment with your latest configuration\. You can find details in [Deploy Cloud Configurations to an AWS IoT Greengrass Core Device](https://docs.aws.amazon.com/greengrass/latest/developerguide/configs-core.html)\.

## Verify that your Lambda function is receiving OPC\-UA Publishes and posting them onto Greengrass<a name="opcua-verify-lambda"></a>

As described in the [Architecture section](#opcua-architecture), your Lambda function should start receiving messages from your OPC\-UA server\. If you are using your own custom OPC\-UA server, make sure you trigger a change in the OPC\-UA node Id you specified, so that you see the change received by your Lambda function\. If you are using the example server above, the PumpSpeed node is configured to simulate a series of consecutive updates, so you should expect your Lambda function to receive multiple messages a second\.

You can see messages received by your Lambda function in one of two ways: 
+ Watch the Lambda function’s logs

   You can view the logs from your Lambda function by running the following command: 

  ```console
   sudo cat ggc/var/log/user/us-west-2/your_account_id/your_function_name.log 
  ```

  The logs should look similar to: 

  ```consle
  [2017-11-14T16:33:09.05Z][INFO]-started subscription : 305964
  
  [2017-11-14T16:33:09.05Z][INFO]-monitoring node id =  ns=1;s=PumpSpeed
  
  [2017-11-14T16:33:09.099Z][INFO]-monitoredItem initialized
  
  [2017-11-15T23:49:34.752Z][INFO]-Publishing message on topic "/opcua/server/node/MyPumpSpeed" with Payload "{"id":"ns=1;s=PumpSpeed","value":{"dataType":"Double","arrayType":"Scalar","value":237.5250759433095}}"
  ```
+ Configure Greengrass to forward messages from your Lambda function to the IoT Cloud\.

  Follow the steps outlined in [Verify the Lambda Function Is Running on the Device](https://docs.aws.amazon.com/greengrass/latest/developerguide/lambda-check.html) to receive messages on the AWS IoT Core console\.

**Note:**
+ Make sure there is a Subscription from your Lambda function going to the IoT Cloud\. Details are in [Configure the Lambda Function for AWS IoT Greengrass](https://docs.aws.amazon.com/greengrass/latest/developerguide/config-lambda.html)\.
+ Since messages are forwarded to the cloud, make sure you terminate either the example server you configured above, or stop the Greengrass core, so that you don't end up publishing a lot of messages to IoT cloud and getting charged for them\!

## License

This solution is licensed under the MIT-0 License. See the LICENSE file.
