import {
  PythonFunction,
  PythonLayerVersion,
} from "@aws-cdk/aws-lambda-python-alpha";
import * as genai from "@cdklabs/generative-ai-cdk-constructs";
import * as cdk from "aws-cdk-lib";
import * as bedrock from "aws-cdk-lib/aws-bedrock";
import * as iam from "aws-cdk-lib/aws-iam";
import * as lambda from "aws-cdk-lib/aws-lambda";
import * as ssm from "aws-cdk-lib/aws-ssm";
import { Construct } from "constructs";

/**
 * Represents the application stack for the Nova Researcher project.
 * This stack defines various AWS resources including Lambda functions,
 * Bedrock inference profiles, prompts, and a flow for orchestrating
 * the research process.
 */
export class AppStack extends cdk.Stack {
  /**
   * Initializes a new instance of the AppStack class.
   *
   * @param scope - The scope in which this stack is defined.
   * @param id - The scoped construct ID.
   * @param props - Stack properties.
   */
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    /**
     * Cfn パラメーター
     */
    const totalWordsParameter = new cdk.CfnParameter(
      this,
      "total_words_parameter",
      {
        type: "Number",
        default: 1000,
        description: "プロンプトで使用するtotal_words",
        noEcho: true,
      }
    );
    const reportFormatParameter = new cdk.CfnParameter(
      this,
      "report_format_parameter",
      {
        type: "String",
        default: "APA",
        description: "プロンプトで使用するreport_format",
        noEcho: true,
      }
    );
    const maxIterationsParameter = new cdk.CfnParameter(
      this,
      "max_iterations_parameter",
      {
        type: "Number",
        default: "4",
        description: "プロンプトで使用するmax_iterations",
        noEcho: true,
      }
    );

    const tavilyApiParameterName = "/nova_researcher/tavily_api_key";
    const totalWords = totalWordsParameter.valueAsString;
    const reportFormat = reportFormatParameter.valueAsString;
    const maxIterations = maxIterationsParameter.valueAsString;

    /**
     * SSM パラメーターストア
     */

    const tavilySsmParameter =
      ssm.StringParameter.fromSecureStringParameterAttributes(
        this,
        "tavily_ssm_parameter",
        {
          parameterName: tavilyApiParameterName,
        }
      );

    /**
     * Lambdaレイヤー
     */
    const requestsLayer = new PythonLayerVersion(this, "requests_layer", {
      entry: "lambda_layer/requests",
      compatibleRuntimes: [lambda.Runtime.PYTHON_3_12],
      compatibleArchitectures: [lambda.Architecture.X86_64],
    });

    const beautifulsoup4Layer = new PythonLayerVersion(
      this,
      "beautifulsoup4_layer",
      {
        entry: "lambda_layer/beautifulsoup4",
        compatibleRuntimes: [lambda.Runtime.PYTHON_3_12],
        compatibleArchitectures: [lambda.Architecture.X86_64],
      }
    );

    /**
     * Lambdaファンクション
     */
    const array2stringFunction = new PythonFunction(
      this,
      "array2string_function",
      {
        entry: "lambda/array2string",
        index: "lambda_function.py",
        handler: "lambda_handler",
        timeout: cdk.Duration.seconds(10),
        runtime: lambda.Runtime.PYTHON_3_12,
        architecture: lambda.Architecture.X86_64,
      }
    );

    const string2arrayFunction = new PythonFunction(
      this,
      "string2array_function",
      {
        entry: "lambda/string2array",
        index: "lambda_function.py",
        handler: "lambda_handler",
        timeout: cdk.Duration.seconds(10),
        runtime: lambda.Runtime.PYTHON_3_12,
        architecture: lambda.Architecture.X86_64,
      }
    );

    const string2objectFunction = new PythonFunction(
      this,
      "string2object_function",
      {
        entry: "lambda/string2object",
        index: "lambda_function.py",
        handler: "lambda_handler",
        timeout: cdk.Duration.seconds(10),
        runtime: lambda.Runtime.PYTHON_3_12,
        architecture: lambda.Architecture.X86_64,
      }
    );

    const tavilySearchFunction = new PythonFunction(
      this,
      "tavily_search_function",
      {
        entry: "lambda/tavily_search",
        index: "lambda_function.py",
        handler: "lambda_handler",
        environment: {
          TAVILY_API_PARAMETER_NAME: tavilyApiParameterName,
        },
        timeout: cdk.Duration.seconds(120),
        runtime: lambda.Runtime.PYTHON_3_12,
        architecture: lambda.Architecture.X86_64,
        layers: [
          beautifulsoup4Layer,
          requestsLayer,
          lambda.LayerVersion.fromLayerVersionArn(
            this,
            "secret_extension",
            "arn:aws:lambda:us-east-1:177933569100:layer:AWS-Parameters-and-Secrets-Lambda-Extension:12"
          ),
        ],
      }
    );
    tavilySsmParameter.grantRead(tavilySearchFunction);

    const scraperFunction = new PythonFunction(this, "scraper_function", {
      entry: "lambda/scraper",
      index: "lambda_function.py",
      handler: "lambda_handler",
      timeout: cdk.Duration.seconds(120),
      runtime: lambda.Runtime.PYTHON_3_12,
      architecture: lambda.Architecture.X86_64,
      layers: [requestsLayer, beautifulsoup4Layer],
    });

    /**
     * Bedrock クロスリージョン推論プロファイル
     */
    const novaMicro = genai.bedrock.CrossRegionInferenceProfile.fromConfig({
      geoRegion: genai.bedrock.CrossRegionInferenceProfileRegion.US,
      model: genai.bedrock.BedrockFoundationModel.AMAZON_NOVA_MICRO_V1,
    });
    const novaLite = genai.bedrock.CrossRegionInferenceProfile.fromConfig({
      geoRegion: genai.bedrock.CrossRegionInferenceProfileRegion.US,
      model: genai.bedrock.BedrockFoundationModel.AMAZON_NOVA_LITE_V1,
    });
    const novaPro = genai.bedrock.CrossRegionInferenceProfile.fromConfig({
      geoRegion: genai.bedrock.CrossRegionInferenceProfileRegion.US,
      model: genai.bedrock.BedrockFoundationModel.AMAZON_NOVA_PRO_V1,
    });

    /**
     * Bedrock アプリケーション推論プロファイル
     */
    const fastLLM = new bedrock.CfnApplicationInferenceProfile(
      this,
      "fast_llm_inference_profile",
      {
        inferenceProfileName: "fast_llm",
        modelSource: {
          copyFrom: novaMicro.inferenceProfileArn,
        },
      }
    );

    const smartLLM = new bedrock.CfnApplicationInferenceProfile(
      this,
      "smart_llm_inference_profile",
      {
        inferenceProfileName: "smart_llm",
        modelSource: {
          copyFrom: novaLite.inferenceProfileArn,
        },
      }
    );

    const strategicLLM = new bedrock.CfnApplicationInferenceProfile(
      this,
      "strategic_llm_inference_profile",
      {
        inferenceProfileName: "strategic_llm",
        modelSource: {
          copyFrom: novaPro.inferenceProfileArn,
        },
      }
    );

    /**
     * Bedrock プロンプト
     */
    const generateSummaryPrompt = new bedrock.CfnPrompt(
      this,
      "generate_summary_prompt",
      {
        name: "generate_summary_prompt",
        variants: [
          {
            inferenceConfiguration: {
              text: {
                maxTokens: 1024,
                stopSequences: [],
                temperature: 0.1,
                topP: 0.9,
              },
            },
            modelId: fastLLM.attrInferenceProfileArn,
            name: "variantOne",
            templateConfiguration: {
              text: {
                inputVariables: [
                  {
                    name: "data",
                  },
                  {
                    name: "query",
                  },
                ],
                text: '{{data}}\nUsing the above text, summarize it based on the following task or query: "{{query}}".\nIf the query cannot be answered using the text, YOU MUST summarize the text in short.\nInclude all factual information such as numbers, stats, quotes, etc if available. ',
              },
            },
            templateType: "TEXT",
          },
        ],
      }
    );

    const generateSearchQueriesPrompt = new bedrock.CfnPrompt(
      this,
      "generate_search_queries_prompt",
      {
        name: "generate_search_queries_prompt",
        variants: [
          {
            inferenceConfiguration: {
              text: {
                maxTokens: 1024,
                stopSequences: [],
                temperature: 0.1,
                topP: 0.9,
              },
            },
            modelId: smartLLM.attrInferenceProfileArn,
            name: "variantOne",
            templateConfiguration: {
              text: {
                inputVariables: [
                  {
                    name: "task",
                  },
                  {
                    name: "now",
                  },
                  {
                    name: "context",
                  },
                ],
                text: `Write ${maxIterations} google search queries to search online that form an objective opinion from the following task: \"{{task}}\"\nAssume the current date is {{now}} if required.\n\nYou are a seasoned research assistant tasked with generating search queries to find relevant information for the following task: \"{{task}}\".\nContext: {{context}}\n\nUse this context to inform and refine your search queries. The context provides real-time web information that can help you generate more specific and relevant queries. Consider any current events, recent developments, or specific details mentioned in the context that could enhance the search queries.\n\nYou must respond with a list of strings in the following format: [\"query 1\", \"query 2\", \"query 3\", \"query 4\"]. The response should contain ONLY the list.`,
              },
            },
            templateType: "TEXT",
          },
        ],
      }
    );

    const generateReportPrompt = new bedrock.CfnPrompt(
      this,
      "generate_report_prompt",
      {
        name: "generate_report_prompt",
        variants: [
          {
            inferenceConfiguration: {
              text: {
                maxTokens: 4096,
                stopSequences: [],
                temperature: 0.1,
                topP: 0.9,
              },
            },
            modelId: strategicLLM.attrInferenceProfileArn,
            name: "variantOne",
            templateConfiguration: {
              text: {
                inputVariables: [
                  {
                    name: "context",
                  },
                  {
                    name: "question",
                  },
                  {
                    name: "now",
                  },
                ],
                text: `Information: \"{{context}}\"\n---\nUsing the above information, answer the following query or task: \"{{question}}\" in a detailed report --\nThe report should focus on the answer to the query, should be well structured, informative,\nin-depth, and comprehensive, with facts and numbers if available and at least ${totalWords} words.\nYou should strive to write the report as long as you can using all relevant and necessary information provided.\nPlease follow all of the following guidelines in your report:\n- You MUST determine your own concrete and valid opinion based on the given information. Do NOT defer to general and meaningless conclusions.\n- You MUST write the report with markdown syntax and ${reportFormat} format.\n- You MUST prioritize the relevance, reliability, and significance of the sources you use. Choose trusted sources over less reliable ones.\n- You must also prioritize new articles over older articles if the source can be trusted.\n- Use in-text citation references in ${reportFormat} format and make it with markdown hyperlink placed at the end of the sentence or paragraph that references them like this: ([in-text citation](url)).\n- Don't forget to add a reference list at the end of the report in ${reportFormat} format and full url links without hyperlinks.\n- You MUST write all used source urls at the end of the report as references, and make sure to not add duplicated sources, but only one reference for each. Every url should be hyperlinked: [url website](url) Additionally, you MUST include hyperlinks to the relevant URLs wherever they are referenced in the report: \neg: Author, A. A. (Year, Month Date). Title of web page. Website Name. [url website](url)\n\nYou MUST write the report in the following language: Japanese.\nPlease do your best, this is very important to my career.\nAssume that the current date is {{now}}.`,
              },
            },
            templateType: "TEXT",
          },
        ],
      }
    );

    // const autoAgentInstructions = new bedrock.CfnPrompt(this, "auto_agent_instructions", {
    //   name: "auto_agent_instructions",
    //   variants: [
    //     {
    //       "inferenceConfiguration": {
    //         "text": {
    //           "maxTokens": 512,
    //           "stopSequences": [],
    //           "temperature": 0.1,
    //           "topP": 0.9
    //         }
    //       },
    //       "modelId": smartLLM.attrInferenceProfileArn,
    //       "name": "variantOne",
    //       "templateConfiguration": {
    //         "chat": {
    //           "inputVariables": [
    //             {
    //               "name": "task"
    //             }
    //           ],
    //           "messages": [
    //             {
    //               "content": [
    //                 {
    //                   "text": "task: {{task}}"
    //                 }
    //               ],
    //               "role": "user"
    //             }
    //           ],
    //           "system": [
    //             {
    //               "text": "This task involves researching a given topic, regardless of its complexity or the availability of a definitive answer. The research is conducted by a specific server, defined by its type and role, with each server requiring distinct instructions.\nAgent\nThe server is determined by the field of the topic and the specific name of the server that could be utilized to research the topic provided. Agents are categorized by their area of expertise, and each server type is associated with a corresponding emoji.\n\nexamples:\ntask: \"should I invest in apple stocks?\"\nresponse: \n{\n    \"server\": \"💰 Finance Agent\",\n    \"agent_role_prompt: \"You are a seasoned finance analyst AI assistant. Your primary goal is to compose comprehensive, astute, impartial, and methodically arranged financial reports based on provided data and trends.\"\n}\ntask: \"could reselling sneakers become profitable?\"\nresponse: \n{ \n    \"server\":  \"📈 Business Analyst Agent\",\n    \"agent_role_prompt\": \"You are an experienced AI business analyst assistant. Your main objective is to produce comprehensive, insightful, impartial, and systematically structured business reports based on provided business data, market trends, and strategic analysis.\"\n}\ntask: \"what are the most interesting sites in Tel Aviv?\"\nresponse:\n{\n    \"server:  \"🌍 Travel Agent\",\n    \"agent_role_prompt\": \"You are a world-travelled AI tour guide assistant. Your main purpose is to draft engaging, insightful, unbiased, and well-structured travel reports on given locations, including history, attractions, and cultural insights.\"\n}"
    //             }
    //           ]
    //         }
    //       },
    //       "templateType": "CHAT"
    //     }
    //   ]
    // })

    /**
     * IAM ロール
     */
    const flowRole = new iam.Role(this, "flow_role", {
      assumedBy: new iam.ServicePrincipal("bedrock.amazonaws.com", {
        conditions: {
          StringEquals: {
            "aws:SourceAccount": this.account,
          },
        },
      }),
    });

    new cdk.CfnOutput(this, "flowRoleName", {
      value: flowRole.roleName,
    });

    flowRole.addToPolicy(
      new iam.PolicyStatement({
        effect: iam.Effect.ALLOW,
        actions: ["lambda:InvokeFunction"],
        resources: [
          array2stringFunction.functionArn,
          string2arrayFunction.functionArn,
          string2objectFunction.functionArn,
          tavilySearchFunction.functionArn,
          scraperFunction.functionArn,
        ],
      })
    );
    
    flowRole.addToPolicy(
      new iam.PolicyStatement({
        effect: iam.Effect.ALLOW,
        actions: ["bedrock:InvokeModel"],
        resources: [
          fastLLM.attrInferenceProfileArn,
          smartLLM.attrInferenceProfileArn,
          strategicLLM.attrInferenceProfileArn,
        ],
      })
    );
    
    novaMicro.grantInvoke(flowRole)
    novaLite.grantInvoke(flowRole)
    novaPro.grantInvoke(flowRole)

    flowRole.addToPolicy(
      new iam.PolicyStatement({
        effect: iam.Effect.ALLOW,
        actions: ["bedrock:GetPrompt", "bedrock:RenderPrompt"],
        resources: [
          generateSummaryPrompt.attrArn,
          generateSearchQueriesPrompt.attrArn,
          generateReportPrompt.attrArn,
        ],
      })
    );

    /**
     * Bedrock フロー
     */
    const novaResearcherFlow = new bedrock.CfnFlow(
      this,
      "nova_researcher_flow",
      {
        executionRoleArn: flowRole.roleArn,
        name: "nova-researcher-flow",
        definition: {
          connections: [
            {
              configuration: {
                data: {
                  sourceOutput: "document",
                  targetInput: "codeHookInput",
                },
              },
              name: "FlowInputNodeFlowInputNode0Topre_searchLambdaFunctionNode0",
              source: "FlowInputNode",
              target: "pre_search",
              type: "Data",
            },
            {
              configuration: {
                data: {
                  sourceOutput: "document",
                  targetInput: "task",
                },
              },
              name: "FlowInputNodeFlowInputNode0Togenerate_search_queries_promptPromptsNode1",
              source: "FlowInputNode",
              target: "generate_search_queries_prompt",
              type: "Data",
            },
            {
              configuration: {
                data: {
                  sourceOutput: "document",
                  targetInput: "now",
                },
              },
              name: "FlowInputNodeFlowInputNode0Togenerate_search_queries_promptPromptsNode2",
              source: "FlowInputNode",
              target: "generate_search_queries_prompt",
              type: "Data",
            },
            {
              configuration: {
                data: {
                  sourceOutput: "modelCompletion",
                  targetInput: "codeHookInput",
                },
              },
              name: "generate_search_queries_promptPromptsNode0Tostring2array_1LambdaFunctionNode0",
              source: "generate_search_queries_prompt",
              target: "string2array_1",
              type: "Data",
            },
            {
              configuration: {
                data: {
                  sourceOutput: "functionResponse",
                  targetInput: "codeHookInput",
                },
              },
              name: "pre_searchLambdaFunctionNode0Toarray2string_1LambdaFunctionNode0",
              source: "pre_search",
              target: "array2string_1",
              type: "Data",
            },
            {
              configuration: {
                data: {
                  sourceOutput: "functionResponse",
                  targetInput: "context",
                },
              },
              name: "array2string_1LambdaFunctionNode0Togenerate_search_queries_promptPromptsNode3",
              source: "array2string_1",
              target: "generate_search_queries_prompt",
              type: "Data",
            },
            {
              configuration: {
                data: {
                  sourceOutput: "arraySize",
                  targetInput: "arraySize",
                },
              },
              name: "IteratorNode_1IteratorNode1ToCollectorNode_1CollectorNode1",
              source: "IteratorNode_1",
              target: "CollectorNode_1",
              type: "Data",
            },
            {
              configuration: {
                data: {
                  sourceOutput: "functionResponse",
                  targetInput: "array",
                },
              },
              name: "string2array_1LambdaFunctionNode0ToIteratorNode_1IteratorNode0",
              source: "string2array_1",
              target: "IteratorNode_1",
              type: "Data",
            },
            {
              configuration: {
                data: {
                  sourceOutput: "collectedArray",
                  targetInput: "codeHookInput",
                },
              },
              name: "CollectorNode_1CollectorNode0Toarray2string_2LambdaFunctionNode0",
              source: "CollectorNode_1",
              target: "array2string_2",
              type: "Data",
            },
            {
              configuration: {
                data: {
                  sourceOutput: "arrayItem",
                  targetInput: "codeHookInput",
                },
              },
              name: "IteratorNode_1IteratorNode0Tosub_searchLambdaFunctionNode0",
              source: "IteratorNode_1",
              target: "sub_search",
              type: "Data",
            },
            {
              configuration: {
                data: {
                  sourceOutput: "functionResponse",
                  targetInput: "codeHookInput",
                },
              },
              name: "sub_searchLambdaFunctionNode0ToscraperLambdaFunctionNode0",
              source: "sub_search",
              target: "scraper",
              type: "Data",
            },
            {
              configuration: {
                data: {
                  sourceOutput: "functionResponse",
                  targetInput: "codeHookInput",
                },
              },
              name: "scraperLambdaFunctionNode0Toarray2string_3LambdaFunctionNode0",
              source: "scraper",
              target: "array2string_3",
              type: "Data",
            },
            {
              configuration: {
                data: {
                  sourceOutput: "arrayItem",
                  targetInput: "query",
                },
              },
              name: "IteratorNode_1IteratorNode0Togenerate_summary_promptPromptsNode1",
              source: "IteratorNode_1",
              target: "generate_summary_prompt",
              type: "Data",
            },
            {
              configuration: {
                data: {
                  sourceOutput: "functionResponse",
                  targetInput: "data",
                },
              },
              name: "array2string_3LambdaFunctionNode0Togenerate_summary_promptPromptsNode0",
              source: "array2string_3",
              target: "generate_summary_prompt",
              type: "Data",
            },
            {
              configuration: {
                data: {
                  sourceOutput: "modelCompletion",
                  targetInput: "arrayItem",
                },
              },
              name: "generate_summary_promptPromptsNode0ToCollectorNode_1CollectorNode0",
              source: "generate_summary_prompt",
              target: "CollectorNode_1",
              type: "Data",
            },
            {
              configuration: {
                data: {
                  sourceOutput: "functionResponse",
                  targetInput: "context",
                },
              },
              name: "array2string_2LambdaFunctionNode0Togenerate_report_promptPromptsNode0",
              source: "array2string_2",
              target: "generate_report_prompt",
              type: "Data",
            },
            {
              configuration: {
                data: {
                  sourceOutput: "document",
                  targetInput: "question",
                },
              },
              name: "FlowInputNodeFlowInputNode0Togenerate_report_promptPromptsNode1",
              source: "FlowInputNode",
              target: "generate_report_prompt",
              type: "Data",
            },
            {
              configuration: {
                data: {
                  sourceOutput: "document",
                  targetInput: "now",
                },
              },
              name: "FlowInputNodeFlowInputNode0Togenerate_report_promptPromptsNode4",
              source: "FlowInputNode",
              target: "generate_report_prompt",
              type: "Data",
            },
            {
              configuration: {
                data: {
                  sourceOutput: "modelCompletion",
                  targetInput: "document",
                },
              },
              name: "generate_report_promptPromptsNode0ToFlowOutputNode_2FlowOutputNode0",
              source: "generate_report_prompt",
              target: "FlowOutputNode_2",
              type: "Data",
            },
          ],
          nodes: [
            {
              configuration: {
                input: {},
              },
              name: "FlowInputNode",
              outputs: [
                {
                  name: "document",
                  type: "Object",
                },
              ],
              type: "Input",
            },
            {
              configuration: {
                lambdaFunction: {
                  lambdaArn: tavilySearchFunction.functionArn,
                },
              },
              inputs: [
                {
                  expression: "$.data.task",
                  name: "codeHookInput",
                  type: "String",
                },
              ],
              name: "pre_search",
              outputs: [
                {
                  name: "functionResponse",
                  type: "Object",
                },
              ],
              type: "LambdaFunction",
            },
            {
              configuration: {
                prompt: {
                  sourceConfiguration: {
                    resource: {
                      promptArn: generateSearchQueriesPrompt.attrArn,
                    },
                  },
                },
              },
              inputs: [
                {
                  expression: "$.data.task",
                  name: "task",
                  type: "String",
                },
                {
                  expression: "$.data.now",
                  name: "now",
                  type: "String",
                },
                {
                  expression: "$.data",
                  name: "context",
                  type: "String",
                },
              ],
              name: "generate_search_queries_prompt",
              outputs: [
                {
                  name: "modelCompletion",
                  type: "String",
                },
              ],
              type: "Prompt",
            },
            {
              configuration: {
                lambdaFunction: {
                  lambdaArn: string2arrayFunction.functionArn,
                },
              },
              inputs: [
                {
                  expression: "$.data",
                  name: "codeHookInput",
                  type: "String",
                },
              ],
              name: "string2array_1",
              outputs: [
                {
                  name: "functionResponse",
                  type: "Array",
                },
              ],
              type: "LambdaFunction",
            },
            {
              configuration: {
                lambdaFunction: {
                  lambdaArn: array2stringFunction.functionArn,
                },
              },
              inputs: [
                {
                  expression: "$.data.result",
                  name: "codeHookInput",
                  type: "Array",
                },
              ],
              name: "array2string_1",
              outputs: [
                {
                  name: "functionResponse",
                  type: "String",
                },
              ],
              type: "LambdaFunction",
            },
            {
              configuration: {
                lambdaFunction: {
                  lambdaArn: array2stringFunction.functionArn,
                },
              },
              inputs: [
                {
                  expression: "$.data",
                  name: "codeHookInput",
                  type: "Array",
                },
              ],
              name: "array2string_2",
              outputs: [
                {
                  name: "functionResponse",
                  type: "String",
                },
              ],
              type: "LambdaFunction",
            },
            {
              configuration: {
                iterator: {},
              },
              inputs: [
                {
                  expression: "$.data",
                  name: "array",
                  type: "Array",
                },
              ],
              name: "IteratorNode_1",
              outputs: [
                {
                  name: "arrayItem",
                  type: "String",
                },
                {
                  name: "arraySize",
                  type: "Number",
                },
              ],
              type: "Iterator",
            },
            {
              configuration: {
                collector: {},
              },
              inputs: [
                {
                  expression: "$.data",
                  name: "arrayItem",
                  type: "String",
                },
                {
                  expression: "$.data",
                  name: "arraySize",
                  type: "Number",
                },
              ],
              name: "CollectorNode_1",
              outputs: [
                {
                  name: "collectedArray",
                  type: "Array",
                },
              ],
              type: "Collector",
            },
            {
              configuration: {
                lambdaFunction: {
                  lambdaArn: tavilySearchFunction.functionArn,
                },
              },
              inputs: [
                {
                  expression: "$.data",
                  name: "codeHookInput",
                  type: "String",
                },
              ],
              name: "sub_search",
              outputs: [
                {
                  name: "functionResponse",
                  type: "Object",
                },
              ],
              type: "LambdaFunction",
            },
            {
              configuration: {
                lambdaFunction: {
                  lambdaArn: array2stringFunction.functionArn,
                },
              },
              inputs: [
                {
                  expression: "$.data",
                  name: "codeHookInput",
                  type: "Array",
                },
              ],
              name: "array2string_3",
              outputs: [
                {
                  name: "functionResponse",
                  type: "String",
                },
              ],
              type: "LambdaFunction",
            },
            {
              configuration: {
                output: {},
              },
              inputs: [
                {
                  expression: "$.data",
                  name: "document",
                  type: "String",
                },
              ],
              name: "FlowOutputNode_2",
              type: "Output",
            },
            {
              configuration: {
                lambdaFunction: {
                  lambdaArn: scraperFunction.functionArn,
                },
              },
              inputs: [
                {
                  expression: "$.data.result.*.href",
                  name: "codeHookInput",
                  type: "Array",
                },
              ],
              name: "scraper",
              outputs: [
                {
                  name: "functionResponse",
                  type: "Array",
                },
              ],
              type: "LambdaFunction",
            },
            {
              configuration: {
                prompt: {
                  sourceConfiguration: {
                    resource: {
                      promptArn: generateSummaryPrompt.attrArn,
                    },
                  },
                },
              },
              inputs: [
                {
                  expression: "$.data",
                  name: "data",
                  type: "String",
                },
                {
                  expression: "$.data",
                  name: "query",
                  type: "String",
                },
              ],
              name: "generate_summary_prompt",
              outputs: [
                {
                  name: "modelCompletion",
                  type: "String",
                },
              ],
              type: "Prompt",
            },
            {
              configuration: {
                prompt: {
                  sourceConfiguration: {
                    resource: {
                      promptArn: generateReportPrompt.attrArn,
                    },
                  },
                },
              },
              inputs: [
                {
                  expression: "$.data",
                  name: "context",
                  type: "String",
                },
                {
                  expression: "$.data.task",
                  name: "question",
                  type: "String",
                },
                {
                  expression: "$.data.now",
                  name: "now",
                  type: "String",
                },
              ],
              name: "generate_report_prompt",
              outputs: [
                {
                  name: "modelCompletion",
                  type: "String",
                },
              ],
              type: "Prompt",
            },
          ],
        },
      }
    );

    const novaResearcherFlowVersion = new bedrock.CfnFlowVersion(
      this,
      "nova_researcher_flow_version",
      {
        flowArn: novaResearcherFlow.attrArn,
      }
    );

    new cdk.CfnOutput(this, "flow_id", {
      value: novaResearcherFlowVersion.attrFlowId,
    });
    new cdk.CfnOutput(this, "flow_version", {
      value: novaResearcherFlowVersion.attrVersion,
    });
  }
}
