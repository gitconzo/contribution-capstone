import {
  AuthenticationDetails,
  CognitoUser,
  CognitoUserPool,
} from "amazon-cognito-identity-js";

const poolData = {
  UserPoolId: process.env.REACT_APP_COGNITO_USER_POOL_ID,
  ClientId: process.env.REACT_APP_COGNITO_CLIENT_ID,
};

const userPool = new CognitoUserPool(poolData);

function normalizeEmail(email) {
  return String(email || "").trim().toLowerCase();
}

function getCognitoUser(email) {
  return new CognitoUser({
    Username: normalizeEmail(email),
    Pool: userPool,
  });
}

export function getCurrentCognitoUser() {
  return userPool.getCurrentUser();
}

export function loginWithCognito(email, password) {
  return new Promise((resolve, reject) => {
    const safeEmail = normalizeEmail(email);

    const authenticationDetails = new AuthenticationDetails({
      Username: safeEmail,
      Password: password,
    });

    const cognitoUser = getCognitoUser(safeEmail);

    cognitoUser.authenticateUser(authenticationDetails, {
      onSuccess: (result) => {
        resolve({
          type: "SUCCESS",
          idToken: result.getIdToken().getJwtToken(),
          accessToken: result.getAccessToken().getJwtToken(),
          refreshToken: result.getRefreshToken().getToken(),
        });
      },
      onFailure: (err) => reject(err),
      newPasswordRequired: (userAttributes, requiredAttributes) => {
        const cleanedAttributes = { ...(userAttributes || {}) };
        delete cleanedAttributes.email_verified;
        delete cleanedAttributes.phone_number_verified;

        resolve({
          type: "NEW_PASSWORD_REQUIRED",
          cognitoUser,
          userAttributes: cleanedAttributes,
          requiredAttributes: requiredAttributes || [],
          email: safeEmail,
        });
      },
    });
  });
}

export function completeNewPassword(cognitoUser, newPassword, userAttributes = {}) {
  return new Promise((resolve, reject) => {
    if (!cognitoUser) {
      reject(new Error("No Cognito user session found for new password setup."));
      return;
    }

    const cleanedAttributes = { ...(userAttributes || {}) };
    delete cleanedAttributes.email_verified;
    delete cleanedAttributes.phone_number_verified;

    cognitoUser.completeNewPasswordChallenge(newPassword, cleanedAttributes, {
      onSuccess: (result) => {
        resolve({
          type: "SUCCESS",
          idToken: result.getIdToken().getJwtToken(),
          accessToken: result.getAccessToken().getJwtToken(),
          refreshToken: result.getRefreshToken().getToken(),
        });
      },
      onFailure: (err) => reject(err),
    });
  });
}

export function forgotPasswordRequest(email) {
  return new Promise((resolve, reject) => {
    const safeEmail = normalizeEmail(email);
    const cognitoUser = getCognitoUser(safeEmail);

    cognitoUser.forgotPassword({
      onSuccess: (result) => resolve(result),
      onFailure: (err) => reject(err),
      inputVerificationCode: () => {
        resolve({ message: "Verification code sent successfully." });
      },
    });
  });
}

export function forgotPasswordConfirm(email, code, newPassword) {
  return new Promise((resolve, reject) => {
    const safeEmail = normalizeEmail(email);
    const cognitoUser = getCognitoUser(safeEmail);

    cognitoUser.confirmPassword(code.trim(), newPassword, {
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