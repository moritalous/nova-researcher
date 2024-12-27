import json
import os

import requests
from tavily_search import TavilySearch


def lambda_handler(event, context):
    print(event)
    query = event["node"]["inputs"][0]["value"]

    aws_session_token = os.environ['AWS_SESSION_TOKEN']
    ssm_parameter_path = os.environ["TAVILY_API_PARAMETER_NAME"].replace(
        "/", "%2F")
    response = requests.get(
        f"http://localhost:2773/systemsmanager/parameters/get?name={ssm_parameter_path}&withDecryption=true", headers={"X-Aws-Parameters-Secrets-Token": aws_session_token})

    result = TavilySearch(query, headers={"tavily_api_key": response.json()[
                          "Parameter"]["Value"]}).search(max_results=5)

    print(result)

    return {"result": result}
