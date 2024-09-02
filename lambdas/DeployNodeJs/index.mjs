import AWS from "aws-sdk";
const cloudFormation = new AWS.CloudFormation();
const sns = new AWS.SNS();
const s3 = new AWS.S3();
const sqs = new AWS.SQS();

const bucketName = process.env.BUCKET_NAME;

export const handler = async (event) => {
  const { email, appType, repoAccess, accessToken, baseDirectory, entrypoint, environmentVariables } = event;
  
  // extract details from request
  let gitUrl = event.gitUrl;
  let port = event.port;
  let repoLocation = gitUrl.split('/').pop().replace('.git', '');
  let envFileContent = "";
  
  // extract variables from environment variable
  const TopicArn = process.env.TOPIC_ARN;
  const ProjectVpc = process.env.PROJECT_VPC;
  const Subnet1Id = process.env.SUBNET1_ID;
  const Subnet2Id = process.env.SUBNET2_ID;
  const SecurityGroupId = process.env.SECURITY_GROUP;
  const QueueUrl = process.env.QUEUE_URL
  
  // check repository access
  if(repoAccess === "private"){
    gitUrl =  `https://${gitUrl.split('/')[3].split(':')[0]}:${accessToken}@${gitUrl.split('//')[1]}`
  }
  
  // check base directory
  if(baseDirectory){
    repoLocation = `${repoLocation}/${baseDirectory}`
  }
  
  // check evironment variables
  if(environmentVariables.length > 0){
    environmentVariables.forEach((variable)=>{
      if(variable.name.includes("PORT")){
        port = variable.value;
      }
      envFileContent += `${variable.name}=${variable.value}\n`
    });
  }
  
  // check if email is already subscribed
  const subscribers = await sns.listSubscriptionsByTopic({ TopicArn }).promise();
  const isSubscribed = (subscribers.Subscriptions || []).some(sub => sub.Endpoint === email);
  
  // send subscription email if user not subscribed
  if(!isSubscribed){
    const subscriptionResponse = await sns.subscribe({
      Protocol: "email",
      TopicArn,
      Endpoint: email,
      Attributes:{
        FilterPolicy: JSON.stringify({
          email: [email]
        })
      }
    }).promise();
    
    console.log(`Subscription email sent to ${email}: `, subscriptionResponse);
  }

  // fetch docker file from s3
  const dockerFileData = await s3.getObject({
      Bucket: bucketName,
      Key: "dockerfilenodejs"
    }).promise();

  // extract docker file content in string
  const dockerFile = dockerFileData.Body.toString('utf-8').replaceAll("index.js", entrypoint);
  
  // create stack name from email and repository location
  const stackName = `${email.split("@")[0]}-${repoLocation.replaceAll("/","-")}`;
  
  // set the stack name, cloud formation template and parameters in the template
  const params = {
    StackName: stackName,
    TemplateURL: `https://${bucketName}.s3.amazonaws.com/NodeBackendCloudFormation.yml`,
    Parameters: [
        {
          ParameterKey: 'ProjectVpc',
          ParameterValue: ProjectVpc
        },
        {
          ParameterKey: 'Subnet1ID',
          ParameterValue: Subnet1Id
        },
        {
          ParameterKey: 'Subnet2ID',
          ParameterValue: Subnet2Id
        },
        {
          ParameterKey: 'SecurityGroupID',
          ParameterValue: SecurityGroupId
        },
        {
          ParameterKey: 'EC2Name',
          ParameterValue: stackName
        },
        {
          ParameterKey: 'GitUrl',
          ParameterValue: gitUrl
        },
        {
          ParameterKey: 'RepoLocation',
          ParameterValue: repoLocation
        },
        {
          ParameterKey: 'DockerFile',
          ParameterValue: dockerFile.replace(/"/g, '\\"')
        },
        {
          ParameterKey: 'EnvFile',
          ParameterValue: envFileContent.replace(/"/g, '\\"')
        },
        {
          ParameterKey: "Port",
          ParameterValue: port
        }
    ]
  };
  
  let stackExists = false;
  try{
    // check if cloud formation with same name exists
    await cloudFormation.describeStacks({ StackName: stackName }).promise();
    stackExists = true;
  }catch(error){
    console.log(error);
  }
  
  try {
    let stackResponse = null;
    if(stackExists){
      console.log("update stack called")
      // update the stack
      stackResponse = await cloudFormation.updateStack(params).promise();
    }else{
      console.log("create stack called")
      // create the stack
      stackResponse = await cloudFormation.createStack(params).promise();
    }
    
    // extract stack id
    const { StackId } = stackResponse;
    console.log('Stack creation initiated:', StackId);
    
    // send the message to queue with email and stack id
    const message = {
      MessageBody: JSON.stringify({ email, appType, repoLocation, stackName, StackId}),
      MessageGroupId: stackName,
      QueueUrl
    };
    const sendMessageResponse = await sqs.sendMessage(message).promise();
    console.log("Message Sent to check status: ", sendMessageResponse);
    
    // return http response back to client
    return {
        statusCode: 200,
        body: JSON.stringify('Stack creation initiated successfully'),
    };
  } catch (err) {
    console.error('Failed to create stack:', err);
    return {
        statusCode: 500,
        body: JSON.stringify('Failed to create stack'),
    };
  }
};

