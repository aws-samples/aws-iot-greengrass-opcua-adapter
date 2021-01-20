import sys
import os
import json
import logging
import csv
import demjson


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

# the file path "MUST" to exist
if len(sys.argv) < 2:
    raise Exception('Please input the file name with path, such as: path/filename ')


endpointName = input("Enter endpointName: ")
# Make sure the endpointName exist
if len(endpointName) == 0:
    raise Exception('Please input the endpointName')

endpointUrl = input("Enter endpointUrl: ")
# Make sure the endpointUrl exist
if len(endpointUrl) == 0:
    raise Exception('Please input the endpointUrl')

certExist = input("Is certExist? Please input yes or no: ")

userIdentitySupport = input("Support userIdentity: Enter 'yes' or 'no' ")

if userIdentitySupport == "yes":
    userName = input("Enter userName:")
    password = input("Enter password:")
else:
    userName = ""
    password = ""

if certExist == "yes":
    certExist = True
    print(certExist)
else:
    certExist = False


print("userName:" + userName )
print("password:" + password )

# read the csv file and load into json format
with open(sys.argv[1]) as csvＦile:
    csvReader = csv.reader(csvＦile, delimiter=',')
    lineCount = 0
    nodeData = {}
    nodeData['OpcNodes']=[]

    for row in csvReader:
        if lineCount == 0:
            print(f'Column names are {", ".join(row)}')
            lineCount += 1
        else:
            print(f'\t{row[0]} / {row[1]} / {row[2]} ')
            id = 'ns=2;' + str(row[0])
            nodeData['OpcNodes'].append({
                'id':id,
                'displayName': row[1]
            })
            # row[0]: Tag Name 
            # row[1]: Address
            # row[2]: Data Type
            lineCount += 1

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

# write data into json file in 'Pretty-Printing'
with open('published_nodes.json', 'w') as outfile:
    json.dump(nodeJsonFile, outfile, indent=4)
