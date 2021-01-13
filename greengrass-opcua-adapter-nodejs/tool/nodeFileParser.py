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
#     "EndpointName": "UNO-2484G",
#     "EndpointUrl": "opc.tcp://localhost:49230",
#     "CertExist": 0,
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


EndpointName = input("Enter EndpointName: ")
# Make sure the EndpointName exist
if len(EndpointName) == 0:
    raise Exception('Please input the EndpointName')

EndpointUrl = input("Enter EndpointUrl: ")
# Make sure the EndpointUrl exist
if len(EndpointUrl) == 0:
    raise Exception('Please input the EndpointUrl')

CertExist = input("Enter CertExist: ")

userIdentitySupport = input("Suppport userIdentity: Enter 'yes' or 'no' ")

if userIdentitySupport == "yes":
    userName = input("Enter userName:")
    password = input("Enter password:")
else:
    userName = ""
    password = ""

if CertExist == "1":
    CertExist = 1;
    print(CertExist)
else:
    CertExist = 0


print("userName:" + userName )
print("password:" + password )

# read the csv file and load into json format
with open(sys.argv[1]) as csv_file:
    csv_reader = csv.reader(csv_file, delimiter=',')
    line_count = 0
    nodeData = {}
    nodeData['OpcNodes']=[]

    for row in csv_reader:
        if line_count == 0:
            print(f'Column names are {", ".join(row)}')
            line_count += 1
        else:
            print(f'\t{row[0]} / {row[1]} / {row[2]} ')
            Id = 'ns=2;' + str(row[0])
            nodeData['OpcNodes'].append({
                'Id':Id,
                'DisplayName': row[1]
            })
            # row[0]: Tag Name 
            # row[1]: Address
            # row[2]: Data Type
            line_count += 1

    print(f'Processed {line_count} lines.')
    print('nodeData:' + str(nodeData))

# fill in the data into json format
nodeJsonFile['serInfo'].append(
    {
        'EndpointName': EndpointName,
        'EndpointUrl':EndpointUrl,
        'CertExist':CertExist,
        'userIdentity':{
          'userName':userName,
          'password':password
        },
        'OpcNodes': nodeData['OpcNodes']
    })

# write data into json file in 'Pretty-Printing'
with open('published_nodes.json', 'w') as outfile:
  json.dump(nodeJsonFile, outfile, indent=4)
