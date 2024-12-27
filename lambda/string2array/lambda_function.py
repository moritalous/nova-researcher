import json


def lambda_handler(event, context):
    value = event["node"]["inputs"][0]["value"]
    return json.loads(value)
