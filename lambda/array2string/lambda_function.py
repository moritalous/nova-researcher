import json


def lambda_handler(event, context):
    """
    AWS Lambda function handler that converts a specific value from the event input to a JSON string.

    Args:
        event (dict): The event dictionary containing the input data. It is expected to have the structure:
                      {
                          "node": {
                              "inputs": [
                                  {
                                      "value": <value_to_convert>
                                  }
                              ]
                          }
                      }
        context (object): The context in which the Lambda function is called. This parameter is not used in this function.

    Returns:
        str: The JSON string representation of the value from the event input.
    """
    value = event["node"]["inputs"][0]["value"]
    return json.dumps(value, ensure_ascii=False)
