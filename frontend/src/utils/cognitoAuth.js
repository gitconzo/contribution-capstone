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
  
  function getCognitoUser(email) {
    const safeEmail = String(email || "").trim().toLowerCase();
  
    return new CognitoUser({
      Username: safeEmail,
      Pool: userPool,
    });
  }
  
  export function loginWithCognito(email, password) {
    return new Promise((resolve, reject) => {
      const safeEmail = String(email || "").trim().toLowerCase();
      const user = getCognitoUser(safeEmail);

      const authDetails = new AuthenticationDetails({
        Username: safeEmail,
        Password: password,
      });

      user.authenticateUser(authDetails, {
        onSuccess: (result) => resolve(result),
        onFailure: (err) => reject(err),
        newPasswordRequired: (userAttributes) => {
          // Strip non-writable attributes before completing the challenge
          delete userAttributes.email_verified;
          delete userAttributes.email;
          resolve({ challenge: "NEW_PASSWORD_REQUIRED", cognitoUser: user, userAttributes });
        },
      });
    });
  }

  export function completeNewPassword(cognitoUser, newPassword) {
    return new Promise((resolve, reject) => {
      cognitoUser.completeNewPasswordChallenge(newPassword, {}, {
        onSuccess: (result) => resolve(result),
        onFailure: (err) => reject(err),
      });
    });
  }
  
  export function forgotPasswordRequest(email) {
    return new Promise((resolve, reject) => {
      const user = getCognitoUser(email);
  
      user.forgotPassword({
        onSuccess: (result) => resolve(result),
        onFailure: (err) => reject(err),
        inputVerificationCode: () => {
          resolve({ message: "Verification code sent." });
        },
      });
    });
  }
  
  export function forgotPasswordConfirm(email, code, newPassword) {
    return new Promise((resolve, reject) => {
      const user = getCognitoUser(email);
  
      user.confirmPassword(code, newPassword, {
        onSuccess: () => resolve({ message: "Password reset successful." }),
        onFailure: (err) => reject(err),
      });
    });
  }
  
  export function changeCurrentUserPassword(oldPassword, newPassword) {
    return new Promise((resolve, reject) => {
      const cognitoUser = userPool.getCurrentUser();
  
      if (!cognitoUser) {
        reject(new Error("No logged-in user found."));
        return;
      }
  
      cognitoUser.getSession((sessionErr) => {
        if (sessionErr) {
          reject(sessionErr);
          return;
        }
  
        cognitoUser.changePassword(oldPassword, newPassword, (err, result) => {
          if (err) {
            reject(err);
            return;
          }
  
          resolve(result);
        });
      });
    });
  }