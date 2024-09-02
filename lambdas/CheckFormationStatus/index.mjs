import AWS from "aws-sdk";
const cloudFormation = new AWS.CloudFormation();
const ec2 = new AWS.EC2();
const elbv2 = new AWS.ELBv2();
const sns = new AWS.SNS();
const sqs = new AWS.SQS();
const dynamoDb = new AWS.DynamoDB();

const MAX_RETRIES = 9;
const RETRY_DELAY = 30 * 1000; // 30 seconds

export const handler = async (event) => {
  const sqsMessage = JSON.parse(event.Records[0].body);
  
  // extract email and stack id from sqs message
  const { email, appType, repoLocation, stackName, StackId } = sqsMessage;
  console.log(`app details: \n${email}, \n${appType} \n${stackName}, \n${StackId}`);
  
  // extract receipt handle
  const messageReceiptHandle = event.Records[0].receiptHandle;
  console.log(`message receipt handle: \n${messageReceiptHandle}`);
  
  // extract environment varible
  const TopicArn = process.env.TOPIC_ARN;
  const QueueUrl = process.env.QUEUE_URL;
  const tableName = process.env.TABLE_NAME;
  console.log(`TopicArn: ${TopicArn}\nQueueUrl: ${QueueUrl}\nTable: ${tableName}`);
  
  // delete the message from queue
  const messageDeleteResponse = await sqs.deleteMessage({
    QueueUrl,
    ReceiptHandle: messageReceiptHandle
  }).promise();
  console.log("Message deleted: ", messageDeleteResponse);
  
  // send deployment started message
  await sns.publish({ 
    TopicArn, 
    Message: "Deployment for your application has started. It may take a few minutes.", 
    Subject:"Deployment Started",
    MessageAttributes:{
      "email":{
        DataType: "String",
        StringValue: email
      }
    }
  }).promise();

  // Check CloudFormation stack status
  let describeStacksResponse = await cloudFormation.describeStacks({ StackName: StackId }).promise();
  let stackStatus = describeStacksResponse.Stacks[0].StackStatus;

  let retry = 0;

  while(retry <= MAX_RETRIES){
    describeStacksResponse = await cloudFormation.describeStacks({ StackName: StackId }).promise();
    stackStatus = describeStacksResponse.Stacks[0].StackStatus;
    console.log(`stack status: ${stackStatus}`);

    if(stackStatus === 'CREATE_COMPLETE' || stackStatus === 'UPDATE_COMPLETE'){
      break;
    }else if(stackStatus === 'ROLLBACK_COMPLETE' || stackStatus === 'UPDATE_ROLLBACK_COMPLETE'){
      await sns.publish({ 
        TopicArn, 
        Message: `Your recent deployment for ${repoLocation} has failed.`, 
        Subject:"Deployment Failed",
        MessageAttributes:{
          "email":{
            DataType: "String",
            StringValue: email
          }
        }
      }).promise();
      return {
        statusCode: 200,
        body: `Deploy failed`
      };
    }

    retry++;
    await new Promise(resolve => setTimeout(resolve, RETRY_DELAY));
  }

  try {
    console.log("stack completed.");
    // Retrieve the EC2 instance ID
    const describeStackResourcesResponse = await cloudFormation.describeStackResources({ StackName: StackId }).promise();
    const instanceId = describeStackResourcesResponse.StackResources.find(resource => resource.ResourceType === 'AWS::EC2::Instance').PhysicalResourceId;
    console.log(`ec2 instance id: ${instanceId}`);

    // Get the public IP address of the EC2 instance
    const describeInstancesResponse = await ec2.describeInstances({ InstanceIds: [instanceId] }).promise();
    const publicIp = describeInstancesResponse.Reservations[0].Instances[0].PublicIpAddress;
    console.log(`public ip: ${publicIp}`);

    // Retrieve the Load Balancer logical ID
    const loadBalancerResource = describeStackResourcesResponse.StackResources.find(resource => resource.ResourceType === 'AWS::ElasticLoadBalancingV2::LoadBalancer');
    
    const loadBalancerArn = loadBalancerResource.PhysicalResourceId;
    console.log(`Load Balancer ARN: ${loadBalancerArn}`);

    // Describe the Load Balancer to get DNS name
    const describeLoadBalancersResponse = await elbv2.describeLoadBalancers({ LoadBalancerArns: [loadBalancerArn] }).promise();
    const loadBalancerDns = describeLoadBalancersResponse.LoadBalancers[0].DNSName;
    console.log(`Load Balancer DNS: ${loadBalancerDns}`);

    // store the email, stack name and ip of created instance in dynamodb
    console.log("Add data in dynamoDb started.")
    await dynamoDb.putItem({
      TableName: tableName,
      Item:{
        stackName: { S: stackName },
        email: { S: email },
        repository: { S: repoLocation },
        appType: { S: appType },
        publicIp: { S: publicIp },
        loadBalancerDns: { S: loadBalancerDns }
      }
    }).promise();
    console.log("Data added in dynamoDb.");
    
    // send the email with deployed url
    await sns.publish({ 
      TopicArn, 
      Message: `Deployed Application URL: http://${loadBalancerDns}`, 
      Subject:"Deployment URL",
      MessageAttributes:{
        "email":{
          DataType: "String",
          StringValue: email
        }
      }
    }).promise();
    console.log(`Email sent with deployed url to ${email}`);
      
    // return http status code
    return {
      statusCode: 200,
      body: `Message Acknowledge`
    };
  }catch(error){
    console.error(`Error checking stack status: ${error.message}`);
    return {
      statusCode: 200,
      body: `Error: ${error.message}`
    };
  }
};

