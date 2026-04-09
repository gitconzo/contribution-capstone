const {
    CognitoIdentityProviderClient,
    AdminCreateUserCommand,
    AdminSetUserPasswordCommand,
    AdminGetUserCommand,
    AdminUpdateUserAttributesCommand,
  } = require("@aws-sdk/client-cognito-identity-provider");
  
  const client = new CognitoIdentityProviderClient({
    region: process.env.AWS_REGION,
  });
  
  const USER_POOL_ID = process.env.COGNITO_USER_POOL_ID;
  
  function normalizeEmail(email) {
    return String(email || "").trim().toLowerCase();
  }
  
  async function userExists(email) {
    const safeEmail = normalizeEmail(email);
  
    try {
      await client.send(
        new AdminGetUserCommand({
          UserPoolId: USER_POOL_ID,
          Username: safeEmail,
        })
      );
      return true;
    } catch (err) {
      if (err.name === "UserNotFoundException") return false;
      throw err;
    }
  }
  
  async function createOrUpdateStudentUser(email, password, name) {
    const safeEmail = normalizeEmail(email);
    const exists = await userExists(safeEmail);
  
    const userAttributes = [
      { Name: "email", Value: safeEmail },
      { Name: "email_verified", Value: "true" },
      { Name: "name", Value: name || "" },
      { Name: "custom:role", Value: "student" },
    ];
  
    if (!exists) {
      await client.send(
        new AdminCreateUserCommand({
          UserPoolId: USER_POOL_ID,
          Username: safeEmail,
          MessageAction: "SUPPRESS",
          UserAttributes: userAttributes,
        })
      );
    } else {
      await client.send(
        new AdminUpdateUserAttributesCommand({
          UserPoolId: USER_POOL_ID,
          Username: safeEmail,
          UserAttributes: userAttributes,
        })
      );
    }
  
    await client.send(
      new AdminSetUserPasswordCommand({
        UserPoolId: USER_POOL_ID,
        Username: safeEmail,
        Password: password,
        Permanent: true,
      })
    );
  
    return { email: safeEmail, created: !exists };
  }
  
  module.exports = {
    createOrUpdateStudentUser,
  };