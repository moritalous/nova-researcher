import json


def lambda_handler(event, context):
    """
    AWS Lambda function to convert a JSON string from the event input to a Python object.

    Args:
        event (dict): The event dictionary containing the input data. 
                      Expected structure:
                      {
                          "node": {
                              "inputs": [
                                  {
                                      "value": "<JSON string>"
                                  }
                              ]
                          }
                      }
        context (object): The context in which the Lambda function is called.

    Returns:
        dict: The Python object obtained by parsing the JSON string from the event input.

    Raises:
        KeyError: If the expected keys are not found in the event dictionary.
        json.JSONDecodeError: If the value is not a valid JSON string.
    """
    value = event["node"]["inputs"][0]["value"]
    return json.loads(value)
