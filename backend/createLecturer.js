const {
    CognitoIdentityProviderClient,
    AdminCreateUserCommand,
    AdminSetUserPasswordCommand,
    AdminGetUserCommand,
    AdminUpdateUserAttributesCommand,
} = require("@aws-sdk/client-cognito-identity-provider");
require("dotenv").config();

const client = new CognitoIdentityProviderClient({
    region: process.env.AWS_REGION,
});

const USER_POOL_ID = process.env.COGNITO_USER_POOL_ID;

const LECTURER_EMAIL = "conzoaftdrk@gmail.com";
const LECTURER_PASSWORD = "Testing123123!";
const LECTURER_NAME = "Lecturer";

function normalizeEmail(email) {
    return String(email || "").trim().toLowerCase();
}

async function userExists(email) {
    try {
        await client.send(
            new AdminGetUserCommand({
                UserPoolId: USER_POOL_ID,
                Username: email,
            })
        );
        return true;
    } catch (err) {
        if (err.name === "UserNotFoundException") return false;
        throw err;
    }
}

async function main() {
    const email = normalizeEmail(LECTURER_EMAIL);
    const exists = await userExists(email);

    const userAttributes = [
        { Name: "email", Value: email },
        { Name: "email_verified", Value: "true" },
        { Name: "name", Value: LECTURER_NAME },
        { Name: "custom:role", Value: "teacher" },
    ];

    if (!exists) {
        await client.send(
            new AdminCreateUserCommand({
                UserPoolId: USER_POOL_ID,
                Username: email,
                MessageAction: "SUPPRESS",
                UserAttributes: userAttributes,
            })
        );
    } else {
        await client.send(
            new AdminUpdateUserAttributesCommand({
                UserPoolId: USER_POOL_ID,
                Username: email,
                UserAttributes: userAttributes,
            })
        );
    }

    await client.send(
        new AdminSetUserPasswordCommand({
            UserPoolId: USER_POOL_ID,
            Username: email,
            Password: LECTURER_PASSWORD,
            Permanent: true,
        })
    );

    console.log("Lecturer account ready:");
    console.log("Email:", email);
    console.log("Password:", LECTURER_PASSWORD);
    console.log("Role: teacher");
}

main().catch((err) => {
    console.error("Failed to create lecturer:", err);
});