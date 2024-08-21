import AWS from "aws-sdk";
const cloudFormation = new AWS.CloudFormation();
const ec2 = new AWS.EC2();
const sns = new AWS.SNS();
const sqs = new AWS.SQS();
const dynamoDb = new AWS.DynamoDB();

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

  await new Promise(resolve => setTimeout(resolve, 120000));

  try {
    // Check CloudFormation stack status
    const describeStacksResponse = await cloudFormation.describeStacks({ StackName: StackId }).promise();
    const stackStatus = describeStacksResponse.Stacks[0].StackStatus;
    console.log(`stack status: ${stackStatus}`);

    if (stackStatus === 'CREATE_COMPLETE') {
      console.log("stack completed.");
      // Retrieve the EC2 instance ID
      const describeStackResourcesResponse = await cloudFormation.describeStackResources({ StackName: StackId }).promise();
      const instanceId = describeStackResourcesResponse.StackResources.find(resource => resource.ResourceType === 'AWS::EC2::Instance').PhysicalResourceId;
      console.log(`ec2 instance id: ${instanceId}`);

      // Get the public IP address of the EC2 instance
      const describeInstancesResponse = await ec2.describeInstances({ InstanceIds: [instanceId] }).promise();
      const publicIp = describeInstancesResponse.Reservations[0].Instances[0].PublicIpAddress;
      console.log(`public ip: ${publicIp}`);
      
      // store the email, stack name and ip of created instance in dynamodb
      console.log("Add data in dynamoDb started.")
      await dynamoDb.putItem({
        TableName: tableName,
        Item:{
          stackName: { S: stackName },
          email: { S: email },
          repository: { S: repoLocation },
          appType: { S: appType },
          publicIp: { S: publicIp }
        }
      }).promise();
      console.log("Data added in dynamoDb.");
      
      // send the email with deployed url
      await sns.publish({ 
        TopicArn, 
        Message: `Deployed Application URL: http://${publicIp}`, 
        Subject:"Deployment URL",
        MessageAttributes:{
          "email":{
            DataType: "String",
            StringValue: email
          }
        }
      }).promise();
      console.log(`Email sent with deployed url to ${email}`);
    }
      
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

