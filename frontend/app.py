import datetime

import boto3
import streamlit as st
from botocore.config import Config

st.title("Nova Researcher")

with st.form("form"):
    flow_identifier = st.text_input("10桁のPrompt Flow IDを入力")
    task = st.text_input("リサーチしたい内容を入力")

    submit = st.form_submit_button("実行")


if submit:
    config = Config(read_timeout=600)
    client = boto3.client("bedrock-agent-runtime", config=config)

    with st.spinner("処理中... 5分ほどお待ち下さい"):

        response = client.invoke_flow(
            flowIdentifier=flow_identifier,
            flowAliasIdentifier="TSTALIASID",
            inputs=[
                {
                    "content": {
                        "document": {
                            "task": task,
                            "now": datetime.datetime.now().strftime(
                                "%Y/%m/%d %H:%M:%S"
                            ),
                        }
                    },
                    "nodeName": "FlowInputNode",
                    "nodeOutputName": "document",
                },
            ],
        )

        output = ""
        for stream in response["responseStream"]:
            if "flowOutputEvent" in stream:
                out = stream["flowOutputEvent"]["content"]["document"]
                output = output + out
                st.write(out)

        st.download_button(
            label="Download Report",
            data=output,
            file_name="report.txt",
            mime="plain/text",
        )
