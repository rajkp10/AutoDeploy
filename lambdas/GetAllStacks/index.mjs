import AWS from "aws-sdk";
const dynamoDb = new AWS.DynamoDB.DocumentClient();

export const handler = async (event) => {
  let records = null;
  const tableName = process.env.TABLE_NAME;
  
  try{
    const data =  await dynamoDb.scan({
      TableName: tableName,
    }).promise();
    console.log(data);
    records = data.Items;
  }catch(error){
    console.log(error);
  }
  
  const response = {
    statusCode: 200,
    records,
  };
  return response;
};
