import json


def lambda_handler(event, context):
    value = event["node"]["inputs"][0]["value"]
    return json.dumps(value, ensure_ascii=False)
