import sys
import os
import json
import logging
import csv
import demjson
import argparse

debugLog = False

parser = argparse.ArgumentParser(description='Convert Node csv file to published_nodes.json file.')

parser.add_argument('--inputFile', '-i', type=str, required=True, help="The csv file to be converted.")
parser.add_argument('--outputPath', '-o', type=str, help="The output path for output file. This path need to end with '/'.")
parser.add_argument('--serverName', '-sn', type=str, required=True, help="OPCUA Server Name.")
parser.add_argument('--endpointURL','-e', type=str, required=True, help="OPCUA Server endpoint URL")
parser.add_argument('--certExist', action='store_true', default=False,
                    help='Used to support certificate validation or not')
parser.add_argument('--userIdentity', action='store_true', default=False,
                    help='Used to support user identity mechanism from the OPC-UA server')
parser.add_argument('--userName', type=str, help="userName used when userIdentity support")
parser.add_argument('--password', type=str, help="password used when userIdentity support")



if debugLog:
    print(parser.parse_args())


nodeJsonFile = {}
nodeJsonFile['serInfo'] = []

# follow the format as follows:   
# [
#  {
#     "endpointName": "UNO-2484G",
#     "endpointUrl": "opc.tcp://localhost:49230",
#     "certExist": false,
#     "userIdentity":
#     {
#       "userName":"user1",
#       "password":"password1"
#     },
#     "OpcNodes": [
#       {
#         "Id": "ns=1;s=PumpSpeed",
#         "DisplayName": "ServerArray"
#       }
#     ]
#  }
# ]

inputFile = parser.parse_args().inputFile
endpointName = parser.parse_args().serverName
if parser.parse_args().outputPath:
    outputPath = parser.parse_args().outputPath
else:
    outputPath = ""
# Make sure the endpointName exist
if len(endpointName) == 0:
    raise Exception('Please input the endpointName')

endpointUrl = parser.parse_args().endpointURL
# Make sure the endpointUrl exist
if len(endpointUrl) == 0:
    raise Exception('Please input the endpointUrl')

certExist = parser.parse_args().certExist

userIdentitySupport = parser.parse_args().userIdentity

if userIdentitySupport:
    userName = parser.parse_args().userName
    password = parser.parse_args().password
else:
    userName = ""
    password = ""

if debugLog:
    print("inputFile:" + inputFile )
    print("outputPath:" + outputPath )
    print("endpointName:" + endpointName )
    print("endpointUrl:" + endpointUrl )
    print("certExist:" + str(certExist ))
    print("userIdentitySupport:" + str(userIdentitySupport ))
    print("userName:" + userName )
    print("password:" + password )

# read the csv file and load into json format
with open(inputFile,'r', encoding='UTF-8')  as csvFile:
    csvReader = csv.reader(csvFile, delimiter=',')
    lineCount = 0
    nodeData = {}
    nodeData['OpcNodes']=[]

    for row in csvReader:
        if lineCount == 0:
            lineCount += 1
            if debugLog:
                print(f'Column names are {", ".join(row)}')
        else:
            if debugLog:
                print(f'\t{row[0]} / {row[1]} / {row[2]} ')
            id = 'ns=2;s=' + str(row[0])
            nodeData['OpcNodes'].append({
                'id':id,
                'displayName': row[1]
            })
            # row[0]: Tag Name 
            # row[1]: Address
            # row[2]: Data Type
            lineCount += 1
    if debugLog:
        print(f'Processed {lineCount} lines.')
        print('nodeData:' + str(nodeData))

# fill in the data into json format
nodeJsonFile['serInfo'].append(
    {
        'endpointName': endpointName,
        'endpointUrl':endpointUrl,
        'certExist':certExist,
        'userIdentity':{
            'userName':userName,
            'password':password
        },
        'OpcNodes': nodeData['OpcNodes']
    })

writePath = ""

if len(outputPath) > 0:
    writePath = outputPath
# write data into json file in 'Pretty-Printing'
with open(writePath + 'published_nodes.json', 'w') as outfile:
    json.dump(nodeJsonFile, outfile, indent=4)
