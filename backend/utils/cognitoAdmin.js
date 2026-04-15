const {
  CognitoIdentityProviderClient,
  AdminCreateUserCommand,
  AdminGetUserCommand,
  AdminUpdateUserAttributesCommand,
  AdminResetUserPasswordCommand,
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

async function getUserStatus(email) {
  const safeEmail = normalizeEmail(email);
  try {
    const res = await client.send(
      new AdminGetUserCommand({
        UserPoolId: USER_POOL_ID,
        Username: safeEmail,
      })
    );
    return res.UserStatus; // e.g. "CONFIRMED", "FORCE_CHANGE_PASSWORD"
  } catch (err) {
    if (err.name === "UserNotFoundException") return "NOT_FOUND";
    throw err;
  }
}

async function createOrUpdateStudentUser(email, name) {
  const safeEmail = normalizeEmail(email);
  const exists = await userExists(safeEmail);

  const userAttributes = [
    { Name: "email", Value: safeEmail },
    { Name: "email_verified", Value: "true" },
    { Name: "name", Value: name || "" },
    { Name: "custom:role", Value: "student" },
  ];

  if (!exists) {
    // New user — Cognito sends invite email with temp password.
    // Account stays in FORCE_CHANGE_PASSWORD until the student sets their own password.
    await client.send(
      new AdminCreateUserCommand({
        UserPoolId: USER_POOL_ID,
        Username: safeEmail,
        UserAttributes: userAttributes,
      })
    );
  } else {
    // Existing account — just update attributes, no password reset, no email.
    await client.send(
      new AdminUpdateUserAttributesCommand({
        UserPoolId: USER_POOL_ID,
        Username: safeEmail,
        UserAttributes: userAttributes,
      })
    );
  }

  return { email: safeEmail, created: !exists };
}

// Resets a student's Cognito password.
// FORCE_CHANGE_PASSWORD users get the invite resent; CONFIRMED users get a password-reset email.
async function resetStudentPassword(email) {
  const safeEmail = normalizeEmail(email);
  const status = await getUserStatus(safeEmail);

  if (status === "NOT_FOUND") {
    throw new Error(`No Cognito account found for ${safeEmail}`);
  }

  if (status === "FORCE_CHANGE_PASSWORD") {
    // Student never set their password — resend the original invite
    await client.send(
      new AdminCreateUserCommand({
        UserPoolId: USER_POOL_ID,
        Username: safeEmail,
        MessageAction: "RESEND",
      })
    );
  } else {
    // Student already has an account — force a password reset email
    await client.send(
      new AdminResetUserPasswordCommand({
        UserPoolId: USER_POOL_ID,
        Username: safeEmail,
      })
    );
  }

  return { email: safeEmail, status };
}

module.exports = {
  createOrUpdateStudentUser,
  getUserStatus,
  resetStudentPassword,
};
