import {
    CognitoUserPool,
    CognitoUser,
    AuthenticationDetails,
  } from "amazon-cognito-identity-js";
  
  console.log("POOL ID =", process.env.REACT_APP_COGNITO_USER_POOL_ID);
  console.log("CLIENT ID =", process.env.REACT_APP_COGNITO_CLIENT_ID);
  
  const poolData = {
    UserPoolId: process.env.REACT_APP_COGNITO_USER_POOL_ID,
    ClientId: process.env.REACT_APP_COGNITO_CLIENT_ID,
  };
  
  const userPool = new CognitoUserPool(poolData);
  
  export function loginWithCognito(email, password) {
    return new Promise((resolve, reject) => {
      const safeEmail = String(email || "").trim().toLowerCase();
  
      const user = new CognitoUser({
        Username: safeEmail,
        Pool: userPool,
      });
  
      const authDetails = new AuthenticationDetails({
        Username: safeEmail,
        Password: password,
      });
  
      user.authenticateUser(authDetails, {
        onSuccess: (result) => resolve(result),
        onFailure: (err) => reject(err),
      });
    });
  }