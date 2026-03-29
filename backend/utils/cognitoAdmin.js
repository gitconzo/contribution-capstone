const {
    CognitoIdentityProviderClient,
    AdminGetUserCommand,
    AdminCreateUserCommand,
    AdminSetUserPasswordCommand,
    AdminUpdateUserAttributesCommand,
  } = require("@aws-sdk/client-cognito-identity-provider");
  
  const client = new CognitoIdentityProviderClient({
    region: process.env.AWS_REGION,
    credentials: {
      accessKeyId: process.env.AWS_ACCESS_KEY_ID,
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
    },
  });
  
  const USER_POOL_ID = process.env.COGNITO_USER_POOL_ID;
  
  async function userExists(username) {
    try {
      await client.send(
        new AdminGetUserCommand({
          UserPoolId: USER_POOL_ID,
          Username: username,
        })
      );
      return true;
    } catch (error) {
      console.error("AdminGetUser error for", username, error);
      if (error.name === "UserNotFoundException") {
        return false;
      }
      throw error;
    }
  }
  
  async function createOrUpdateStudentUser(email, password, name) {
    console.log("createOrUpdateStudentUser called with:", email, password, name);
    console.log("Using pool:", USER_POOL_ID, "region:", process.env.AWS_REGION);
  
    const username = String(email || "").trim().toLowerCase();
  
    if (!username) {
      throw new Error("Student email is required for Cognito account creation.");
    }
  
    const exists = await userExists(username);
  
    if (!exists) {
      await client.send(
        new AdminCreateUserCommand({
          UserPoolId: USER_POOL_ID,
          Username: username,
          MessageAction: "SUPPRESS",
          UserAttributes: [
            { Name: "email", Value: username },
            { Name: "email_verified", Value: "true" },
            ...(name ? [{ Name: "name", Value: String(name) }] : []),
          ],
        })
      );
    } else {
      await client.send(
        new AdminUpdateUserAttributesCommand({
          UserPoolId: USER_POOL_ID,
          Username: username,
          UserAttributes: [
            { Name: "email", Value: username },
            { Name: "email_verified", Value: "true" },
            ...(name ? [{ Name: "name", Value: String(name) }] : []),
          ],
        })
      );
    }
  
    console.log("SETTING PASSWORD FOR:", username, password);
  
    await client.send(
      new AdminSetUserPasswordCommand({
        UserPoolId: USER_POOL_ID,
        Username: username,
        Password: password,
        Permanent: true,
      })
    );
  
    return { email: username, created: !exists };
  }
  
  module.exports = {
    createOrUpdateStudentUser,
  };